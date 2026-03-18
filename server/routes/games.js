// server/routes/games.js
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Get all teams
router.get('/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY region, seed');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get full bracket (all games with team info)
router.get('/bracket', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        g.id, g.round, g.region, g.position, g.status,
        g.team1_score, g.team2_score, g.next_game_id, g.game_time,
        g.team1_id, g.team2_id, g.winner_id,
        t1.name as team1_name, t1.seed as team1_seed, t1.is_eliminated as team1_eliminated,
        t2.name as team2_name, t2.seed as team2_seed, t2.is_eliminated as team2_eliminated,
        w.name as winner_name, w.seed as winner_seed
      FROM games g
      LEFT JOIN teams t1 ON g.team1_id = t1.id
      LEFT JOIN teams t2 ON g.team2_id = t2.id
      LEFT JOIN teams w ON g.winner_id = w.id
      ORDER BY g.round, g.region, g.position
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Bracket error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update game result (set winner, propagate to next round)
router.post('/games/:id/result', async (req, res) => {
  const client = await pool.connect();
  try {
    const gameId = parseInt(req.params.id);
    const { winner_id, team1_score, team2_score } = req.body;

    await client.query('BEGIN');

    // Update the game
    await client.query(`
      UPDATE games 
      SET winner_id = $1, team1_score = $2, team2_score = $3, status = 'final'
      WHERE id = $4
    `, [winner_id, team1_score || 0, team2_score || 0, gameId]);

    // Get the game to find next_game_id and position
    const { rows: [game] } = await client.query(
      'SELECT * FROM games WHERE id = $1', [gameId]
    );

    // Mark losing team as eliminated
    const loserId = winner_id === game.team1_id ? game.team2_id : game.team1_id;
    if (loserId) {
      await client.query('UPDATE teams SET is_eliminated = TRUE WHERE id = $1', [loserId]);
    }

    // Propagate winner to next game
    if (game.next_game_id) {
      // Find which slot: get all games that feed into the next game, sorted by ID
      const { rows: feeders } = await client.query(
        'SELECT id FROM games WHERE next_game_id = $1 ORDER BY id', [game.next_game_id]
      );
      // First feeder (lower ID) -> team1, second -> team2
      const slot = feeders.length > 0 && feeders[0].id === gameId ? 'team1_id' : 'team2_id';
      await client.query(
        `UPDATE games SET ${slot} = $1 WHERE id = $2`,
        [winner_id, game.next_game_id]
      );
    }

    // Score all user picks for this game
    await client.query(`
      UPDATE picks 
      SET is_correct = (picked_team_id = $1),
          points_earned = CASE 
            WHEN picked_team_id = $1 THEN
              CASE (SELECT round FROM games WHERE id = $2)
                WHEN 1 THEN 10
                WHEN 2 THEN 20
                WHEN 3 THEN 40
                WHEN 4 THEN 80
                WHEN 5 THEN 160
                WHEN 6 THEN 320
                ELSE 0
              END
            ELSE 0
          END
      WHERE game_id = $2
    `, [winner_id, gameId]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Game result updated and propagated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Result update error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Admin: Set game as live
router.post('/games/:id/live', async (req, res) => {
  try {
    await pool.query("UPDATE games SET status = 'live' WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update live scores (without setting winner)
router.post('/games/:id/score', async (req, res) => {
  try {
    const { team1_score, team2_score } = req.body;
    await pool.query(
      "UPDATE games SET team1_score = $1, team2_score = $2, status = 'live' WHERE id = $3",
      [team1_score, team2_score, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
