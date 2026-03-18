// reset-and-reseed.js - Complete database reset with verification
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found! Check your .env file.');
  process.exit(1);
}

console.log('Connecting to:', process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@'));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('\n=== STEP 1: Drop old tables ===');
  await pool.query('DROP TABLE IF EXISTS picks, brackets, games, teams, users CASCADE');
  console.log('Done');

  console.log('\n=== STEP 2: Create tables ===');
  await pool.query(`
    CREATE TABLE users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, display_name VARCHAR(100), created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE teams (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, seed INTEGER NOT NULL, region VARCHAR(20) NOT NULL, is_eliminated BOOLEAN DEFAULT FALSE);
    CREATE TABLE games (id SERIAL PRIMARY KEY, round INTEGER NOT NULL, region VARCHAR(20), position INTEGER NOT NULL, team1_id INTEGER REFERENCES teams(id), team2_id INTEGER REFERENCES teams(id), team1_score INTEGER, team2_score INTEGER, winner_id INTEGER REFERENCES teams(id), status VARCHAR(20) DEFAULT 'upcoming', game_time TIMESTAMP, next_game_id INTEGER REFERENCES games(id));
    CREATE TABLE brackets (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL DEFAULT 'My Bracket', created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE picks (id SERIAL PRIMARY KEY, bracket_id INTEGER REFERENCES brackets(id) ON DELETE CASCADE, game_id INTEGER REFERENCES games(id) ON DELETE CASCADE, picked_team_id INTEGER REFERENCES teams(id), is_correct BOOLEAN, points_earned INTEGER DEFAULT 0, picked_at TIMESTAMP DEFAULT NOW(), UNIQUE(bracket_id, game_id));
  `);
  console.log('Done');

  console.log('\n=== STEP 3: Seed 64 teams ===');
  const regions = {
    East: [['Duke',1],['Siena',16],['Ohio State',8],['TCU',9],["St. John's",5],['Northern Iowa',12],['Kansas',4],['Cal Baptist',13],['Louisville',6],['South Florida',11],['Michigan State',3],['North Dakota St',14],['UCLA',7],['UCF',10],['UConn',2],['Furman',15]],
    West: [['Arizona',1],['LIU',16],['Villanova',8],['Utah State',9],['Wisconsin',5],['High Point',12],['Arkansas',4],['Hawaii',13],['BYU',6],['NC State',11],['Gonzaga',3],['Kennesaw St',14],['Miami',7],['Missouri',10],['Purdue',2],['Queens',15]],
    Midwest: [['Michigan',1],['UMBC',16],['Georgia',8],['Saint Louis',9],['Texas Tech',5],['Akron',12],['Alabama',4],['Hofstra',13],['Tennessee',6],['SMU',11],['Virginia',3],['Wright State',14],['Kentucky',7],['Santa Clara',10],['Iowa State',2],['Tennessee St',15]],
    South: [['Florida',1],['Lehigh',16],['Clemson',8],['Iowa',9],['Vanderbilt',5],['McNeese',12],['Nebraska',4],['Troy',13],['North Carolina',6],['VCU',11],['Illinois',3],['Penn',14],["Saint Mary's",7],['Texas A&M',10],['Houston',2],['Idaho',15]]
  };
  for (const [region, teams] of Object.entries(regions)) {
    for (const [name, seed] of teams) {
      await pool.query('INSERT INTO teams (name, seed, region) VALUES ($1, $2, $3)', [name, seed, region]);
    }
  }
  console.log('Done - 64 teams');

  console.log('\n=== STEP 4: Create 63 games ===');
  const regionOrder = ['East', 'West', 'Midwest', 'South'];
  let gid = 1;
  const gm = {};

  for (const region of regionOrder) {
    const { rows: teams } = await pool.query('SELECT id FROM teams WHERE region = $1 ORDER BY id', [region]);
    for (let p = 0; p < 8; p++) {
      await pool.query('INSERT INTO games (id,round,region,position,team1_id,team2_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7)', [gid, 1, region, p, teams[p*2].id, teams[p*2+1].id, 'upcoming']);
      gm[`${region}-1-${p}`] = gid++;
    }
    for (let p = 0; p < 4; p++) { await pool.query('INSERT INTO games (id,round,region,position,status) VALUES ($1,$2,$3,$4,$5)', [gid,2,region,p,'upcoming']); gm[`${region}-2-${p}`] = gid++; }
    for (let p = 0; p < 2; p++) { await pool.query('INSERT INTO games (id,round,region,position,status) VALUES ($1,$2,$3,$4,$5)', [gid,3,region,p,'upcoming']); gm[`${region}-3-${p}`] = gid++; }
    await pool.query('INSERT INTO games (id,round,region,position,status) VALUES ($1,$2,$3,$4,$5)', [gid,4,region,0,'upcoming']); gm[`${region}-4`] = gid++;
  }
  await pool.query('INSERT INTO games (id,round,region,position,status) VALUES ($1,$2,$3,$4,$5)', [gid,5,'Final Four',0,'upcoming']); gm['FF0'] = gid++;
  await pool.query('INSERT INTO games (id,round,region,position,status) VALUES ($1,$2,$3,$4,$5)', [gid,5,'Final Four',1,'upcoming']); gm['FF1'] = gid++;
  await pool.query('INSERT INTO games (id,round,region,position,status) VALUES ($1,$2,$3,$4,$5)', [gid,6,'Championship',0,'upcoming']); gm['CHAMP'] = gid;
  console.log('Done - 63 games');

  console.log('\n=== STEP 5: Link all games ===');
  for (const region of regionOrder) {
    for (let p = 0; p < 8; p++) await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm[`${region}-2-${Math.floor(p/2)}`], gm[`${region}-1-${p}`]]);
    for (let p = 0; p < 4; p++) await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm[`${region}-3-${Math.floor(p/2)}`], gm[`${region}-2-${p}`]]);
    for (let p = 0; p < 2; p++) await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm[`${region}-4`], gm[`${region}-3-${p}`]]);
  }
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm['FF0'], gm['East-4']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm['FF0'], gm['West-4']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm['FF1'], gm['Midwest-4']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm['FF1'], gm['South-4']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm['CHAMP'], gm['FF0']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gm['CHAMP'], gm['FF1']]);
  console.log('Done');

  console.log('\n=== STEP 6: VERIFY ===');
  const { rows: unlinked } = await pool.query('SELECT id, round, region FROM games WHERE next_game_id IS NULL AND round < 6');
  if (unlinked.length > 0) {
    console.log('BAD - These games have no next_game_id:');
    unlinked.forEach(g => console.log(`  Game ${g.id} R${g.round} ${g.region}`));
  } else {
    console.log('All 62 games linked (championship has no next)');
  }

  const { rows: e8 } = await pool.query('SELECT id, region, next_game_id FROM games WHERE round=4 ORDER BY id');
  console.log('\nE8 to Final Four links:');
  e8.forEach(g => console.log(`  ${g.region} E8 (game ${g.id}) -> FF game ${g.next_game_id}`));

  const { rows: ff } = await pool.query('SELECT id, position, next_game_id FROM games WHERE round=5 ORDER BY id');
  console.log('\nFinal Four to Championship:');
  ff.forEach(g => console.log(`  FF pos ${g.position} (game ${g.id}) -> Champ game ${g.next_game_id}`));

  console.log('\n✅ ALL DONE! Refresh your app and create a new account.\n');
  process.exit(0);
}

run().catch(err => { console.error('FAILED:', err.message); console.error(err.stack); process.exit(1); });
