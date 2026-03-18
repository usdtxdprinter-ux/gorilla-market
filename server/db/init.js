// server/db/init.js
// Run this once to set up your database tables
// Usage: node server/db/init.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initSQL = `
-- Users (simple username login)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tournament teams
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  seed INTEGER NOT NULL,
  region VARCHAR(20) NOT NULL,
  logo_url TEXT,
  is_eliminated BOOLEAN DEFAULT FALSE
);

-- Master bracket games (actual results)
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

-- User bracket picks
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_picks_bracket ON picks(bracket_id);
CREATE INDEX IF NOT EXISTS idx_picks_game ON picks(game_id);
CREATE INDEX IF NOT EXISTS idx_brackets_user ON brackets(user_id);
CREATE INDEX IF NOT EXISTS idx_games_round ON games(round);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
`;

async function init() {
  try {
    console.log('Connecting to database...');
    await pool.query(initSQL);
    console.log('✅ All tables created successfully!');
    
    // Check if teams exist, if not seed the 2026 bracket
    const { rows } = await pool.query('SELECT COUNT(*) FROM teams');
    if (parseInt(rows[0].count) === 0) {
      console.log('Seeding tournament teams...');
      await seedTeams();
      console.log('✅ Teams seeded!');
      
      console.log('Creating game slots...');
      await seedGames();
      console.log('✅ Games created!');
    } else {
      console.log('Teams already seeded, skipping...');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Database init failed:', err.message);
    process.exit(1);
  }
}

async function seedTeams() {
  // 2026 NCAA Tournament bracket (64 teams, 4 regions)
  // Announced Selection Sunday, March 15, 2026
  // Order: 1,16, 8,9, 5,12, 4,13, 6,11, 3,14, 7,10, 2,15
  // First Four play-in winners TBD — placeholders used for 16/11 slots
  const regions = {
    East: [
      'Duke','Siena',
      'Ohio State','TCU',
      "St. John's",'Northern Iowa',
      'Kansas','Cal Baptist',
      'Louisville','South Florida',
      'Michigan State','North Dakota St',
      'UCLA','UCF',
      'UConn','Furman'
    ],
    West: [
      'Arizona','LIU',
      'Villanova','Utah State',
      'Wisconsin','High Point',
      'Arkansas','Hawaii',
      'BYU','NC State',
      'Gonzaga','Kennesaw St',
      'Miami','Missouri',
      'Purdue','Queens'
    ],
    Midwest: [
      'Michigan','UMBC',
      'Georgia','Saint Louis',
      'Texas Tech','Akron',
      'Alabama','Hofstra',
      'Tennessee','SMU',
      'Virginia','Wright State',
      'Kentucky','Santa Clara',
      'Iowa State','Tennessee St'
    ],
    South: [
      'Florida','Lehigh',
      'Clemson','Iowa',
      'Vanderbilt','McNeese',
      'Nebraska','Troy',
      'North Carolina','VCU',
      'Illinois','Penn',
      "Saint Mary's",'Texas A&M',
      'Houston','Idaho'
    ]
  };

  for (const [region, teams] of Object.entries(regions)) {
    const seeds = [1,16,8,9,5,12,4,13,6,11,3,14,7,10,2,15];
    for (let i = 0; i < teams.length; i++) {
      await pool.query(
        'INSERT INTO teams (name, seed, region) VALUES ($1, $2, $3)',
        [teams[i], seeds[i], region]
      );
    }
  }
}

async function seedGames() {
  const regions = ['South', 'West', 'East', 'Midwest'];
  
  // Create games for each region (rounds 1-4)
  // Round 1: 8 games per region (32 total)
  // Round 2: 4 games per region (16 total)  
  // Round 3 (Sweet 16): 2 per region (8 total)
  // Round 4 (Elite 8): 1 per region (4 total)
  // Round 5 (Final Four): 2 games
  // Round 6 (Championship): 1 game
  
  let gameId = 1;
  const gameMap = {}; // track game IDs for linking
  
  for (const region of regions) {
    // Get teams for this region in seed-matchup order
    const { rows: teams } = await pool.query(
      'SELECT id, seed FROM teams WHERE region = $1 ORDER BY id',
      [region]
    );
    
    // Round 1: 8 matchups (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)
    for (let pos = 0; pos < 8; pos++) {
      const t1 = teams[pos * 2];
      const t2 = teams[pos * 2 + 1];
      await pool.query(
        'INSERT INTO games (id, round, region, position, team1_id, team2_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [gameId, 1, region, pos, t1.id, t2.id, 'upcoming']
      );
      gameMap[`${region}-1-${pos}`] = gameId;
      gameId++;
    }
    
    // Round 2: 4 games
    for (let pos = 0; pos < 4; pos++) {
      await pool.query(
        'INSERT INTO games (id, round, region, position, status) VALUES ($1, $2, $3, $4, $5)',
        [gameId, 2, region, pos, 'upcoming']
      );
      gameMap[`${region}-2-${pos}`] = gameId;
      gameId++;
    }
    
    // Round 3 (Sweet 16): 2 games
    for (let pos = 0; pos < 2; pos++) {
      await pool.query(
        'INSERT INTO games (id, round, region, position, status) VALUES ($1, $2, $3, $4, $5)',
        [gameId, 3, region, pos, 'upcoming']
      );
      gameMap[`${region}-3-${pos}`] = gameId;
      gameId++;
    }
    
    // Round 4 (Elite 8): 1 game
    await pool.query(
      'INSERT INTO games (id, round, region, position, status) VALUES ($1, $2, $3, $4, $5)',
      [gameId, 4, region, 0, 'upcoming']
    );
    gameMap[`${region}-4-0`] = gameId;
    gameId++;
  }
  
  // Round 5 (Final Four): 2 games (South vs West, East vs Midwest)
  for (let pos = 0; pos < 2; pos++) {
    await pool.query(
      'INSERT INTO games (id, round, region, position, status) VALUES ($1, $2, $3, $4, $5)',
      [gameId, 5, 'Final Four', pos, 'upcoming']
    );
    gameMap[`FF-5-${pos}`] = gameId;
    gameId++;
  }
  
  // Round 6 (Championship): 1 game
  await pool.query(
    'INSERT INTO games (id, round, region, position, status) VALUES ($1, $2, $3, $4, $5)',
    [gameId, 6, 'Championship', 0, 'upcoming']
  );
  gameMap['CHAMP-6-0'] = gameId;
  
  // Now link games with next_game_id
  for (const region of regions) {
    // R1 -> R2
    for (let pos = 0; pos < 8; pos++) {
      const r2Pos = Math.floor(pos / 2);
      await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
        [gameMap[`${region}-2-${r2Pos}`], gameMap[`${region}-1-${pos}`]]);
    }
    // R2 -> R3
    for (let pos = 0; pos < 4; pos++) {
      const r3Pos = Math.floor(pos / 2);
      await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
        [gameMap[`${region}-3-${r3Pos}`], gameMap[`${region}-2-${pos}`]]);
    }
    // R3 -> R4
    for (let pos = 0; pos < 2; pos++) {
      await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
        [gameMap[`${region}-4-0`], gameMap[`${region}-3-${pos}`]]);
    }
  }
  
  // E8 -> FF (South vs West = FF game 0, East vs Midwest = FF game 1)
  await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
    [gameMap['FF-5-0'], gameMap['South-4-0']]);
  await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
    [gameMap['FF-5-0'], gameMap['West-4-0']]);
  await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
    [gameMap['FF-5-1'], gameMap['East-4-0']]);
  await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
    [gameMap['FF-5-1'], gameMap['Midwest-4-0']]);
  
  // FF -> Championship
  await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
    [gameMap['CHAMP-6-0'], gameMap['FF-5-0']]);
  await pool.query('UPDATE games SET next_game_id = $1 WHERE id = $2',
    [gameMap['CHAMP-6-0'], gameMap['FF-5-1']]);
}

init();
