// server/routes/liveScores.js
// ESPN for live scores (free, no key), Odds API for moneylines only

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

const API_KEY = process.env.ODDS_API_KEY;
const SPORT = 'basketball_ncaab';
const BASE_URL = 'https://api.the-odds-api.com/v4/sports';
const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';

// ── TEAM NAME MAPPING (covers both ESPN and Odds API names) ──
const API_TO_DB_NAME = {
  // ESPN uses short names like "Duke", "Kansas", etc. but also full like "Blue Devils"
  // Odds API uses "Duke Blue Devils", etc.
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
  "Hawai'i Rainbow Warriors": 'Hawaii', 'BYU Cougars': 'BYU',
  'Gonzaga Bulldogs': 'Gonzaga', 'Kennesaw State Owls': 'Kennesaw St', 'Kennesaw St Owls': 'Kennesaw St',
  'Miami Hurricanes': 'Miami', 'Miami (FL) Hurricanes': 'Miami',
  'Missouri Tigers': 'Missouri', 'Purdue Boilermakers': 'Purdue',
  'Queens Royals': 'Queens', 'Queens (NC) Royals': 'Queens',
  'Michigan Wolverines': 'Michigan', 'Howard Bison': 'Howard',
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
  'VCU Rams': 'VCU', 'Illinois Fighting Illini': 'Illinois',
  'Penn Quakers': 'Penn', 'Pennsylvania Quakers': 'Penn',
  "Saint Mary's Gaels": "Saint Mary's", "St. Mary's Gaels": "Saint Mary's",
  'Texas A&M Aggies': 'Texas A&M', 'Houston Cougars': 'Houston', 'Idaho Vandals': 'Idaho',
  'Texas Longhorns': 'Texas', 'NC State Wolfpack': 'NC State',
  'Miami (OH) RedHawks': 'Miami (OH)', 'Miami Ohio RedHawks': 'Miami (OH)',
  'Prairie View A&M Panthers': 'Prairie View A&M',
  // ESPN short names
  'Duke': 'Duke', 'Siena': 'Siena', 'Ohio State': 'Ohio State', 'TCU': 'TCU',
  "St. John's": "St. John's", 'N Iowa': 'Northern Iowa', 'Northern Iowa': 'Northern Iowa',
  'Kansas': 'Kansas', 'Cal Baptist': 'Cal Baptist', 'CBU': 'Cal Baptist',
  'Louisville': 'Louisville', 'South Florida': 'South Florida', 'USF': 'South Florida',
  'Michigan St': 'Michigan State', 'Michigan State': 'Michigan State',
  'North Dakota St': 'North Dakota St', 'NDSU': 'North Dakota St',
  'UCLA': 'UCLA', 'UCF': 'UCF', 'UConn': 'UConn', 'Furman': 'Furman',
  'Arizona': 'Arizona', 'LIU': 'LIU', 'Villanova': 'Villanova',
  'Utah St': 'Utah State', 'Utah State': 'Utah State',
  'Wisconsin': 'Wisconsin', 'High Point': 'High Point',
  'Arkansas': 'Arkansas', "Hawai'i": 'Hawaii', 'Hawaii': 'Hawaii',
  'BYU': 'BYU', 'Gonzaga': 'Gonzaga',
  'Kennesaw St': 'Kennesaw St', 'Kennesaw State': 'Kennesaw St',
  'Miami': 'Miami', 'Missouri': 'Missouri', 'Purdue': 'Purdue', 'Queens': 'Queens',
  'Michigan': 'Michigan', 'Howard': 'Howard',
  'Georgia': 'Georgia', 'Saint Louis': 'Saint Louis',
  'Texas Tech': 'Texas Tech', 'Akron': 'Akron',
  'Alabama': 'Alabama', 'Hofstra': 'Hofstra',
  'Tennessee': 'Tennessee', 'SMU': 'SMU',
  'Virginia': 'Virginia', 'Wright St': 'Wright State', 'Wright State': 'Wright State',
  'Kentucky': 'Kentucky', 'Santa Clara': 'Santa Clara',
  'Iowa State': 'Iowa State', 'Iowa St': 'Iowa State',
  'Tennessee St': 'Tennessee St', 'Tennessee State': 'Tennessee St',
  'Florida': 'Florida', 'Lehigh': 'Lehigh',
  'Clemson': 'Clemson', 'Iowa': 'Iowa',
  'Vanderbilt': 'Vanderbilt', 'McNeese': 'McNeese',
  'Nebraska': 'Nebraska', 'Troy': 'Troy',
  'North Carolina': 'North Carolina', 'UNC': 'North Carolina',
  'VCU': 'VCU', 'Illinois': 'Illinois', 'Penn': 'Penn',
  "Saint Mary's": "Saint Mary's", "St. Mary's": "Saint Mary's",
  'Texas A&M': 'Texas A&M', 'Houston': 'Houston', 'Idaho': 'Idaho',
  'Texas': 'Texas', 'Miami (OH)': 'Miami (OH)', 'Miami Ohio': 'Miami (OH)',
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
  // Don't spam warnings for non-tournament teams
  return null;
}

// ── ESPN SCORES (FREE, NO KEY) ──────────────────────────────
async function fetchESPNScores() {
  try {
    // Fetch today's games and yesterday's (for late finishes)
    const res = await fetch(ESPN_URL);
    if (!res.ok) { console.error(`ESPN error: ${res.status}`); return []; }
    const data = await res.json();
    const events = data.events || [];
    
    const games = [];
    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp || !comp.competitors || comp.competitors.length < 2) continue;

      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const status = event.status?.type;
      games.push({
        home_team: home.team?.displayName || home.team?.shortDisplayName || '',
        away_team: away.team?.displayName || away.team?.shortDisplayName || '',
        home_short: home.team?.shortDisplayName || '',
        away_short: away.team?.shortDisplayName || '',
        home_score: parseInt(home.score || '0'),
        away_score: parseInt(away.score || '0'),
        completed: status?.completed || false,
        in_progress: status?.state === 'in' || false,
        status_detail: event.status?.type?.detail || '',
        game_time: event.date || null
      });
    }
    console.log(`ESPN: ${games.length} games found, ${games.filter(g => g.in_progress).length} live, ${games.filter(g => g.completed).length} final`);
    return games;
  } catch (err) {
    console.error('ESPN fetch failed:', err.message);
    return [];
  }
}

// ── FETCH ODDS (MONEYLINES) — Odds API ──────────────────────
async function fetchOdds() {
  if (!API_KEY) return [];
  try {
    const url = `${BASE_URL}/${SPORT}/odds?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=american`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`Odds API error: ${res.status}`); return []; }
    const remaining = res.headers.get('x-requests-remaining');
    const used = res.headers.get('x-requests-used');
    console.log(`Odds API: ${used} used, ${remaining} remaining`);
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

    await client.query("UPDATE games SET winner_id = $1, status = 'final' WHERE id = $2", [winnerId, gameId]);

    const loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;
    if (loserId) await client.query('UPDATE teams SET is_eliminated = TRUE WHERE id = $1', [loserId]);

    if (game.next_game_id) {
      const { rows: feeders } = await client.query(
        'SELECT id FROM games WHERE next_game_id = $1 ORDER BY id', [game.next_game_id]
      );
      const slot = feeders.length > 0 && feeders[0].id === gameId ? 'team1_id' : 'team2_id';
      await client.query(`UPDATE games SET ${slot} = $1 WHERE id = $2`, [winnerId, game.next_game_id]);
    }

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
    console.log(`🏆 Winner set for game #${gameId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Winner error game #${gameId}:`, err.message);
  } finally {
    client.release();
  }
}

// ── UPDATE SCORES FROM ESPN ─────────────────────────────────
async function updateScoresFromESPN() {
  const espnGames = await fetchESPNScores();
  if (espnGames.length === 0) return { updated: 0, errors: 0, autoWinners: 0 };

  let updated = 0, errors = 0, autoWinners = 0;

  for (const eg of espnGames) {
    try {
      // Try matching by display name first, then short name
      let homeTeam = await findTeamByName(eg.home_team);
      if (!homeTeam) homeTeam = await findTeamByName(eg.home_short);
      let awayTeam = await findTeamByName(eg.away_team);
      if (!awayTeam) awayTeam = await findTeamByName(eg.away_short);
      if (!homeTeam || !awayTeam) continue;

      const { rows } = await pool.query(
        `SELECT id, team1_id, team2_id, status, winner_id FROM games 
         WHERE (team1_id = $1 AND team2_id = $2) OR (team1_id = $2 AND team2_id = $1)`,
        [homeTeam.id, awayTeam.id]
      );
      if (rows.length === 0) continue;
      const dbGame = rows[0];
      if (dbGame.status === 'final') continue;

      let team1Score, team2Score;
      if (dbGame.team1_id === homeTeam.id) {
        team1Score = eg.home_score; team2Score = eg.away_score;
      } else {
        team1Score = eg.away_score; team2Score = eg.home_score;
      }

      const newStatus = eg.completed ? 'final' : eg.in_progress ? 'live' : 'upcoming';

      // Update scores and game time
      await pool.query(
        "UPDATE games SET team1_score = $1, team2_score = $2, status = $3, game_time = COALESCE(game_time, $5) WHERE id = $4",
        [team1Score, team2Score, eg.completed ? 'live' : newStatus, dbGame.id, eg.game_time]
      );
      updated++;

      // If completed, auto-set winner
      if (eg.completed && !dbGame.winner_id) {
        const winnerId = team1Score > team2Score ? dbGame.team1_id : dbGame.team2_id;
        await setWinnerAndPropagate(dbGame.id, winnerId);
        autoWinners++;
        console.log(`🏀 FINAL: ${eg.home_team} ${eg.home_score} - ${eg.away_score} ${eg.away_team}`);
      }
    } catch (err) {
      errors++;
      console.error(`ESPN update error:`, err.message);
    }
  }

  if (updated > 0 || autoWinners > 0) {
    console.log(`ESPN scores: ${updated} updated, ${autoWinners} winners set, ${errors} errors`);
  }
  return { updated, errors, autoWinners };
}

// ── STORE ODDS IN MEMORY ────────────────────────────────────
let currentOdds = {};

async function updateOdds() {
  const apiOdds = await fetchOdds();
  if (apiOdds.length === 0) return;

  const odds = {};
  for (const game of apiOdds) {
    const homeTeam = await findTeamByName(game.home_team);
    const awayTeam = await findTeamByName(game.away_team);
    if (!homeTeam || !awayTeam) continue;

    const bookie = game.bookmakers?.[0];
    if (!bookie) continue;
    const h2h = bookie.markets?.find(m => m.key === 'h2h');
    if (!h2h) continue;

    const homeOdds = h2h.outcomes?.find(o => o.name === game.home_team)?.price;
    const awayOdds = h2h.outcomes?.find(o => o.name === game.away_team)?.price;

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

    odds[dbGame.id] = { team1_odds: team1Odds, team2_odds: team2Odds, bookmaker: bookie.title, last_update: h2h.last_update };

    if (game.commence_time) {
      await pool.query('UPDATE games SET game_time = COALESCE(game_time, $1) WHERE id = $2', [game.commence_time, dbGame.id]);
    }
  }

  currentOdds = odds;
  console.log(`Odds updated: ${Object.keys(odds).length} games with moneylines`);
}

// ── ROUTES ───────────────────────────────────────────────────
router.post('/update-scores', async (req, res) => {
  const result = await updateScoresFromESPN();
  res.json({ success: true, ...result });
});

router.get('/odds', (req, res) => {
  res.json(currentOdds);
});

router.get('/status', (req, res) => {
  res.json({
    oddsApiKeyConfigured: !!API_KEY,
    espn: 'active (free)',
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
  console.log('Starting ESPN score polling every 30s');
  
  // ESPN scores: every 30 seconds (free, no quota)
  updateScoresFromESPN();
  global.scorePollingInterval = setInterval(updateScoresFromESPN, 30000);

  // Odds API: only if key configured, every 5 minutes
  if (API_KEY) {
    console.log('Odds API configured — polling odds every 5 minutes');
    updateOdds();
    global.oddsPollingInterval = setInterval(updateOdds, 300000);
  } else {
    console.log('No ODDS_API_KEY — odds disabled, ESPN scores still active');
  }
}

function stopPolling() {
  if (global.scorePollingInterval) { clearInterval(global.scorePollingInterval); global.scorePollingInterval = null; }
  if (global.oddsPollingInterval) { clearInterval(global.oddsPollingInterval); global.oddsPollingInterval = null; }
  console.log('Polling stopped');
}

module.exports = router;
module.exports.startPolling = startPolling;
module.exports.stopPolling = stopPolling;
