// server/routes/liveScores.js
// Fully automatic: fetches scores, sets winners, propagates bracket, fetches odds
// Docs: https://the-odds-api.com/liveapi/guides/v4/

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

const API_KEY = process.env.ODDS_API_KEY;
const SPORT = 'basketball_ncaab';
const BASE_URL = 'https://api.the-odds-api.com/v4/sports';

// ── TEAM NAME MAPPING ────────────────────────────────────────
const API_TO_DB_NAME = {
  'Duke Blue Devils': 'Duke', 'Siena Saints': 'Siena',
  'Ohio State Buckeyes': 'Ohio State', 'TCU Horned Frogs': 'TCU',
  "St. John's Red Storm": "St. John's", "St John's Red Storm": "St. John's",
  'Northern Iowa Panthers': 'Northern Iowa',
  'Kansas Jayhawks': 'Kansas', 'California Baptist Lancers': 'Cal Baptist',
  'Cal Baptist Lancers': 'Cal Baptist', 'Louisville Cardinals': 'Louisville',
  'South Florida Bulls': 'South Florida', 'Michigan State Spartans': 'Michigan State',
  'North Dakota State Bison': 'North Dakota St', 'North Dakota St Bison': 'North Dakota St',
  'UCLA Bruins': 'UCLA', 'UCF Knights': 'UCF',
  'UConn Huskies': 'UConn', 'Connecticut Huskies': 'UConn', 'Furman Paladins': 'Furman',
  'Arizona Wildcats': 'Arizona', 'LIU Sharks': 'LIU', 'Long Island Sharks': 'LIU',
  'Villanova Wildcats': 'Villanova', 'Utah State Aggies': 'Utah State', 'Utah St Aggies': 'Utah State',
  'Wisconsin Badgers': 'Wisconsin', 'High Point Panthers': 'High Point',
  'Arkansas Razorbacks': 'Arkansas', 'Hawaii Rainbow Warriors': 'Hawaii',
  "Hawai'i Rainbow Warriors": 'Hawaii', 'BYU Cougars': 'BYU', 'NC State Wolfpack': 'NC State',
  'Gonzaga Bulldogs': 'Gonzaga', 'Kennesaw State Owls': 'Kennesaw St', 'Kennesaw St Owls': 'Kennesaw St',
  'Miami Hurricanes': 'Miami', 'Miami (FL) Hurricanes': 'Miami',
  'Missouri Tigers': 'Missouri', 'Purdue Boilermakers': 'Purdue',
  'Queens Royals': 'Queens', 'Queens (NC) Royals': 'Queens',
  'Michigan Wolverines': 'Michigan', 'UMBC Retrievers': 'UMBC',
  'Georgia Bulldogs': 'Georgia', 'Saint Louis Billikens': 'Saint Louis',
  'Texas Tech Red Raiders': 'Texas Tech', 'Akron Zips': 'Akron',
  'Alabama Crimson Tide': 'Alabama', 'Hofstra Pride': 'Hofstra',
  'Tennessee Volunteers': 'Tennessee', 'SMU Mustangs': 'SMU',
  'Virginia Cavaliers': 'Virginia', 'Wright State Raiders': 'Wright State', 'Wright St Raiders': 'Wright State',
  'Kentucky Wildcats': 'Kentucky', 'Santa Clara Broncos': 'Santa Clara',
  'Iowa State Cyclones': 'Iowa State', 'Tennessee State Tigers': 'Tennessee St', 'Tennessee St Tigers': 'Tennessee St',
  'Florida Gators': 'Florida', 'Lehigh Mountain Hawks': 'Lehigh',
  'Clemson Tigers': 'Clemson', 'Iowa Hawkeyes': 'Iowa',
  'Vanderbilt Commodores': 'Vanderbilt', 'McNeese Cowboys': 'McNeese',
  'McNeese State Cowboys': 'McNeese', 'McNeese St Cowboys': 'McNeese',
  'Nebraska Cornhuskers': 'Nebraska', 'Troy Trojans': 'Troy',
  'North Carolina Tar Heels': 'North Carolina', 'UNC Tar Heels': 'North Carolina',
  'VCU Rams': 'VCU', 'Illinois Fighting Illini': 'Illinois', 'Penn Quakers': 'Penn', 'Pennsylvania Quakers': 'Penn',
  "Saint Mary's Gaels": "Saint Mary's", "St. Mary's Gaels": "Saint Mary's",
  'Texas A&M Aggies': 'Texas A&M', 'Houston Cougars': 'Houston', 'Idaho Vandals': 'Idaho',
  'Howard Bison': 'Howard', 'Texas Longhorns': 'Texas',
  'Miami (OH) RedHawks': 'Miami (OH)', 'Miami Ohio RedHawks': 'Miami (OH)',
  'Prairie View A&M Panthers': 'Prairie View A&M',
};

// ── TEAM CACHE ───────────────────────────────────────────────
let dbTeamCache = null;

async function loadTeamCache() {
  const { rows } = await pool.query('SELECT id, name FROM teams');
  dbTeamCache = {};
  rows.forEach(r => { dbTeamCache[r.name.toLowerCase()] = r; });
  console.log(`Loaded ${rows.length} teams into cache`);
}

async function findTeamByName(apiName) {
  if (!dbTeamCache) await loadTeamCache();
  const mapped = API_TO_DB_NAME[apiName];
  if (mapped && dbTeamCache[mapped.toLowerCase()]) return dbTeamCache[mapped.toLowerCase()];
  if (dbTeamCache[apiName.toLowerCase()]) return dbTeamCache[apiName.toLowerCase()];
  for (const [key, team] of Object.entries(dbTeamCache)) {
    if (apiName.toLowerCase().startsWith(key + ' ')) return team;
  }
  console.warn(`⚠️  No match for: "${apiName}" — add to API_TO_DB_NAME`);
  return null;
}

// ── FETCH SCORES ─────────────────────────────────────────────
async function fetchLiveScores() {
  if (!API_KEY) return [];
  try {
    const url = `${BASE_URL}/${SPORT}/scores?apiKey=${API_KEY}&daysFrom=1`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`Odds API scores error: ${res.status}`); return []; }
    const remaining = res.headers.get('x-requests-remaining');
    const used = res.headers.get('x-requests-used');
    console.log(`Odds API (scores): ${used} used, ${remaining} remaining`);
    return await res.json();
  } catch (err) { console.error('Scores fetch failed:', err.message); return []; }
}

// ── FETCH ODDS (MONEYLINES) ──────────────────────────────────
async function fetchOdds() {
  if (!API_KEY) return [];
  try {
    const url = `${BASE_URL}/${SPORT}/odds?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=american`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`Odds API odds error: ${res.status}`); return []; }
    const remaining = res.headers.get('x-requests-remaining');
    const used = res.headers.get('x-requests-used');
    console.log(`Odds API (odds): ${used} used, ${remaining} remaining`);
    return await res.json();
  } catch (err) { console.error('Odds fetch failed:', err.message); return []; }
}

// ── AUTO-SET WINNER & PROPAGATE ──────────────────────────────
async function setWinnerAndPropagate(gameId, winnerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [game] } = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (!game) { await client.query('ROLLBACK'); return; }

    await client.query(
      "UPDATE games SET winner_id = $1, status = 'final' WHERE id = $2",
      [winnerId, gameId]
    );

    // Mark loser eliminated
    const loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;
    if (loserId) {
      await client.query('UPDATE teams SET is_eliminated = TRUE WHERE id = $1', [loserId]);
    }

    // Propagate winner to next game
    if (game.next_game_id) {
      const { rows: feeders } = await client.query(
        'SELECT id FROM games WHERE next_game_id = $1 ORDER BY id', [game.next_game_id]
      );
      const slot = feeders.length > 0 && feeders[0].id === gameId ? 'team1_id' : 'team2_id';
      await client.query(`UPDATE games SET ${slot} = $1 WHERE id = $2`, [winnerId, game.next_game_id]);
    }

    // Score all picks for this game
    await client.query(`
      UPDATE picks 
      SET is_correct = (picked_team_id = $1),
          points_earned = CASE 
            WHEN picked_team_id = $1 THEN
              CASE (SELECT round FROM games WHERE id = $2)
                WHEN 1 THEN 10 WHEN 2 THEN 20 WHEN 3 THEN 40
                WHEN 4 THEN 80 WHEN 5 THEN 160 WHEN 6 THEN 320 ELSE 0
              END
            ELSE 0
          END
      WHERE game_id = $2
    `, [winnerId, gameId]);

    await client.query('COMMIT');
    console.log(`🏆 Auto-set winner for game #${gameId}, propagated to next round`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Winner propagation error game #${gameId}:`, err.message);
  } finally {
    client.release();
  }
}

// ── UPDATE SCORES (FULLY AUTOMATIC) ─────────────────────────
async function updateScoresFromAPI() {
  const apiGames = await fetchLiveScores();
  if (apiGames.length === 0) return { updated: 0, errors: 0 };

  let updated = 0, errors = 0, autoWinners = 0;

  for (const apiGame of apiGames) {
    if (!apiGame.scores || apiGame.scores.length < 2) continue;

    try {
      const homeTeam = await findTeamByName(apiGame.home_team);
      const awayTeam = await findTeamByName(apiGame.away_team);
      if (!homeTeam || !awayTeam) continue;

      const { rows } = await pool.query(
        `SELECT id, team1_id, team2_id, status, winner_id FROM games 
         WHERE (team1_id = $1 AND team2_id = $2) OR (team1_id = $2 AND team2_id = $1)`,
        [homeTeam.id, awayTeam.id]
      );
      if (rows.length === 0) continue;
      const dbGame = rows[0];
      if (dbGame.status === 'final') continue;

      const homeScore = parseInt(apiGame.scores.find(s => s.name === apiGame.home_team)?.score || '0');
      const awayScore = parseInt(apiGame.scores.find(s => s.name === apiGame.away_team)?.score || '0');

      let team1Score, team2Score;
      if (dbGame.team1_id === homeTeam.id) {
        team1Score = homeScore; team2Score = awayScore;
      } else {
        team1Score = awayScore; team2Score = homeScore;
      }

      // Update scores and game time
      await pool.query(
        "UPDATE games SET team1_score = $1, team2_score = $2, status = 'live', game_time = COALESCE(game_time, $4) WHERE id = $3",
        [team1Score, team2Score, dbGame.id, apiGame.commence_time || null]
      );
      updated++;

      // If game completed, AUTO-SET WINNER and propagate
      if (apiGame.completed && !dbGame.winner_id) {
        const winnerId = team1Score > team2Score ? dbGame.team1_id : dbGame.team2_id;
        await setWinnerAndPropagate(dbGame.id, winnerId);
        autoWinners++;
        console.log(`🏀 FINAL: ${apiGame.home_team} ${homeScore} - ${awayScore} ${apiGame.away_team}`);
      }
    } catch (err) {
      errors++;
      console.error(`Error updating ${apiGame.id}:`, err.message);
    }
  }

  console.log(`Live scores: ${updated} updated, ${autoWinners} winners set, ${errors} errors`);
  return { updated, errors, autoWinners };
}

// ── STORE ODDS IN MEMORY (served to frontend) ───────────────
let currentOdds = {};

async function updateOdds() {
  const apiOdds = await fetchOdds();
  if (apiOdds.length === 0) return;

  const odds = {};
  for (const game of apiOdds) {
    const homeTeam = await findTeamByName(game.home_team);
    const awayTeam = await findTeamByName(game.away_team);
    if (!homeTeam || !awayTeam) continue;

    // Get the first bookmaker's h2h odds
    const bookie = game.bookmakers?.[0];
    if (!bookie) continue;
    const h2h = bookie.markets?.find(m => m.key === 'h2h');
    if (!h2h) continue;

    const homeOdds = h2h.outcomes?.find(o => o.name === game.home_team)?.price;
    const awayOdds = h2h.outcomes?.find(o => o.name === game.away_team)?.price;

    // Find the game in DB
    const { rows } = await pool.query(
      `SELECT id, team1_id, team2_id FROM games 
       WHERE (team1_id = $1 AND team2_id = $2) OR (team1_id = $2 AND team2_id = $1)`,
      [homeTeam.id, awayTeam.id]
    );
    if (rows.length === 0) continue;
    const dbGame = rows[0];

    let team1Odds, team2Odds;
    if (dbGame.team1_id === homeTeam.id) {
      team1Odds = homeOdds; team2Odds = awayOdds;
    } else {
      team1Odds = awayOdds; team2Odds = homeOdds;
    }

    odds[dbGame.id] = {
      team1_odds: team1Odds,
      team2_odds: team2Odds,
      bookmaker: bookie.title,
      last_update: h2h.last_update
    };

    // Also save game_time from odds API (commence_time)
    if (game.commence_time) {
      await pool.query(
        'UPDATE games SET game_time = COALESCE(game_time, $1) WHERE id = $2',
        [game.commence_time, dbGame.id]
      );
    }
  }

  currentOdds = odds;
  console.log(`Odds updated: ${Object.keys(odds).length} games with moneylines`);
}

// ── ROUTES ───────────────────────────────────────────────────
router.post('/update-scores', async (req, res) => {
  const result = await updateScoresFromAPI();
  res.json({ success: true, ...result });
});

router.get('/odds', (req, res) => {
  res.json(currentOdds);
});

router.get('/status', (req, res) => {
  res.json({
    apiKeyConfigured: !!API_KEY,
    sport: SPORT,
    pollingActive: !!global.scorePollingInterval,
    oddsGames: Object.keys(currentOdds).length
  });
});

router.get('/test-match/:teamName', async (req, res) => {
  const team = await findTeamByName(decodeURIComponent(req.params.teamName));
  res.json({ input: req.params.teamName, matched: team || 'NOT FOUND' });
});

// ── POLLING ──────────────────────────────────────────────────
function startPolling(intervalMs = 60000) {
  if (!API_KEY) {
    console.log('No ODDS_API_KEY — live updates disabled. Use Admin panel.');
    return;
  }
  console.log(`Starting auto-polling every ${intervalMs / 1000}s (scores + odds)`);

  // Run immediately
  updateScoresFromAPI();
  updateOdds();

  // Scores every 60s, odds every 5 minutes (saves API quota)
  global.scorePollingInterval = setInterval(updateScoresFromAPI, intervalMs);
  global.oddsPollingInterval = setInterval(updateOdds, 300000);
}

function stopPolling() {
  if (global.scorePollingInterval) { clearInterval(global.scorePollingInterval); global.scorePollingInterval = null; }
  if (global.oddsPollingInterval) { clearInterval(global.oddsPollingInterval); global.oddsPollingInterval = null; }
  console.log('Polling stopped');
}

module.exports = router;
module.exports.startPolling = startPolling;
module.exports.stopPolling = stopPolling;
