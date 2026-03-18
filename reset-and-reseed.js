// reset-and-reseed.js
// Run this from ANY folder that has node_modules and a .env file
// It wipes the old teams and reseeds with the 2026 bracket

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  // Step 1: Drop old tables
  console.log('Step 1: Dropping old tables...');
  await pool.query('DROP TABLE IF EXISTS picks, brackets, games, teams, users CASCADE');
  console.log('Done - old tables removed.');

  // Step 2: Create fresh tables
  console.log('Step 2: Creating fresh tables...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      display_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      seed INTEGER NOT NULL,
      region VARCHAR(20) NOT NULL,
      logo_url TEXT,
      is_eliminated BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      round INTEGER NOT NULL,
      region VARCHAR(20),
      position INTEGER NOT NULL,
      team1_id INTEGER REFERENCES teams(id),
      team2_id INTEGER REFERENCES teams(id),
      team1_score INTEGER,
      team2_score INTEGER,
      winner_id INTEGER REFERENCES teams(id),
      status VARCHAR(20) DEFAULT 'upcoming',
      game_time TIMESTAMP,
      next_game_id INTEGER REFERENCES games(id)
    );
    CREATE TABLE IF NOT EXISTS brackets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL DEFAULT 'My Bracket',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS picks (
      id SERIAL PRIMARY KEY,
      bracket_id INTEGER REFERENCES brackets(id) ON DELETE CASCADE,
      game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
      picked_team_id INTEGER REFERENCES teams(id),
      is_correct BOOLEAN,
      points_earned INTEGER DEFAULT 0,
      picked_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(bracket_id, game_id)
    );
    CREATE INDEX IF NOT EXISTS idx_picks_bracket ON picks(bracket_id);
    CREATE INDEX IF NOT EXISTS idx_picks_game ON picks(game_id);
    CREATE INDEX IF NOT EXISTS idx_brackets_user ON brackets(user_id);
    CREATE INDEX IF NOT EXISTS idx_games_round ON games(round);
    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
  `);
  console.log('Done - tables created.');

  // Step 3: Seed 2026 NCAA Tournament teams
  console.log('Step 3: Seeding 2026 tournament teams...');
  const regions = {
    East: [
      ['Duke',1],['Siena',16],['Ohio State',8],['TCU',9],
      ["St. John's",5],['Northern Iowa',12],['Kansas',4],['Cal Baptist',13],
      ['Louisville',6],['South Florida',11],['Michigan State',3],['North Dakota St',14],
      ['UCLA',7],['UCF',10],['UConn',2],['Furman',15]
    ],
    West: [
      ['Arizona',1],['LIU',16],['Villanova',8],['Utah State',9],
      ['Wisconsin',5],['High Point',12],['Arkansas',4],['Hawaii',13],
      ['BYU',6],['NC State',11],['Gonzaga',3],['Kennesaw St',14],
      ['Miami',7],['Missouri',10],['Purdue',2],['Queens',15]
    ],
    Midwest: [
      ['Michigan',1],['UMBC',16],['Georgia',8],['Saint Louis',9],
      ['Texas Tech',5],['Akron',12],['Alabama',4],['Hofstra',13],
      ['Tennessee',6],['SMU',11],['Virginia',3],['Wright State',14],
      ['Kentucky',7],['Santa Clara',10],['Iowa State',2],['Tennessee St',15]
    ],
    South: [
      ['Florida',1],['Lehigh',16],['Clemson',8],['Iowa',9],
      ['Vanderbilt',5],['McNeese',12],['Nebraska',4],['Troy',13],
      ['North Carolina',6],['VCU',11],['Illinois',3],['Penn',14],
      ["Saint Mary's",7],['Texas A&M',10],['Houston',2],['Idaho',15]
    ]
  };

  for (const [region, teams] of Object.entries(regions)) {
    for (const [name, seed] of teams) {
      await pool.query(
        'INSERT INTO teams (name, seed, region) VALUES ($1, $2, $3)',
        [name, seed, region]
      );
    }
  }
  console.log('Done - 64 teams seeded.');

  // Step 4: Create all 63 games with matchup links
  console.log('Step 4: Creating 63 game slots...');
  const regionNames = ['East', 'West', 'Midwest', 'South'];
  let gameId = 1;
  const gameMap = {};

  for (const region of regionNames) {
    const { rows: teams } = await pool.query(
      'SELECT id, seed FROM teams WHERE region = $1 ORDER BY id', [region]
    );

    // Round 1: 8 games per region
    for (let pos = 0; pos < 8; pos++) {
      await pool.query(
        'INSERT INTO games (id, round, region, position, team1_id, team2_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [gameId, 1, region, pos, teams[pos * 2].id, teams[pos * 2 + 1].id, 'upcoming']
      );
      gameMap[`${region}-1-${pos}`] = gameId;
      gameId++;
    }
    // Round 2: 4 games
    for (let pos = 0; pos < 4; pos++) {
      await pool.query(
        'INSERT INTO games (id, round, region, position, status) VALUES ($1,$2,$3,$4,$5)',
        [gameId, 2, region, pos, 'upcoming']
      );
      gameMap[`${region}-2-${pos}`] = gameId;
      gameId++;
    }
    // Round 3 (Sweet 16): 2 games
    for (let pos = 0; pos < 2; pos++) {
      await pool.query(
        'INSERT INTO games (id, round, region, position, status) VALUES ($1,$2,$3,$4,$5)',
        [gameId, 3, region, pos, 'upcoming']
      );
      gameMap[`${region}-3-${pos}`] = gameId;
      gameId++;
    }
    // Round 4 (Elite 8): 1 game
    await pool.query(
      'INSERT INTO games (id, round, region, position, status) VALUES ($1,$2,$3,$4,$5)',
      [gameId, 4, region, 0, 'upcoming']
    );
    gameMap[`${region}-4-0`] = gameId;
    gameId++;
  }

  // Final Four: 2 games
  for (let pos = 0; pos < 2; pos++) {
    await pool.query(
      'INSERT INTO games (id, round, region, position, status) VALUES ($1,$2,$3,$4,$5)',
      [gameId, 5, 'Final Four', pos, 'upcoming']
    );
    gameMap[`FF-5-${pos}`] = gameId;
    gameId++;
  }

  // Championship: 1 game
  await pool.query(
    'INSERT INTO games (id, round, region, position, status) VALUES ($1,$2,$3,$4,$5)',
    [gameId, 6, 'Championship', 0, 'upcoming']
  );
  gameMap['CHAMP-6-0'] = gameId;

  // Link games: R1->R2, R2->R3, R3->R4, R4->FF, FF->Champ
  for (const region of regionNames) {
    for (let pos = 0; pos < 8; pos++) {
      await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2',
        [gameMap[`${region}-2-${Math.floor(pos/2)}`], gameMap[`${region}-1-${pos}`]]);
    }
    for (let pos = 0; pos < 4; pos++) {
      await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2',
        [gameMap[`${region}-3-${Math.floor(pos/2)}`], gameMap[`${region}-2-${pos}`]]);
    }
    for (let pos = 0; pos < 2; pos++) {
      await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2',
        [gameMap[`${region}-4-0`], gameMap[`${region}-3-${pos}`]]);
    }
  }
  // E8 -> FF
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gameMap['FF-5-0'], gameMap['East-4-0']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gameMap['FF-5-0'], gameMap['West-4-0']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gameMap['FF-5-1'], gameMap['Midwest-4-0']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gameMap['FF-5-1'], gameMap['South-4-0']]);
  // FF -> Championship
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gameMap['CHAMP-6-0'], gameMap['FF-5-0']]);
  await pool.query('UPDATE games SET next_game_id=$1 WHERE id=$2', [gameMap['CHAMP-6-0'], gameMap['FF-5-1']]);

  console.log('Done - 63 games created and linked.');
  console.log('');
  console.log('=== ALL DONE! ===');
  console.log('Refresh your app in the browser to see the 2026 bracket.');
  console.log('You will need to create a new account since users were wiped.');
  process.exit(0);
}

run().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
