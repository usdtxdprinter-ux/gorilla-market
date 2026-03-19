// server/routes/picks.js
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Lock deadline: March 19, 2026 9:00 AM CDT (14:00 UTC)
const LOCK_DEADLINE = new Date('2026-03-19T14:00:00Z');

// Submit picks for a specific bracket (bulk)
router.post('/submit', async (req, res) => {
  // Check lock
  if (new Date() >= LOCK_DEADLINE) {
    return res.status(403).json({ error: 'Brackets are locked! Picks closed at 9:00 AM CT on March 19.' });
  }

  const client = await pool.connect();
  try {
    const { bracket_id, picks } = req.body;

    if (!bracket_id || !picks || !Array.isArray(picks)) {
      return res.status(400).json({ error: 'Invalid picks data' });
    }

    await client.query('BEGIN');

    for (const pick of picks) {
      await client.query(`
        INSERT INTO picks (bracket_id, game_id, picked_team_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (bracket_id, game_id) 
        DO UPDATE SET picked_team_id = $3, picked_at = NOW()
      `, [bracket_id, pick.game_id, pick.picked_team_id]);
    }

    await client.query('COMMIT');
    res.json({ success: true, count: picks.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Submit picks error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Get picks for a specific bracket
router.get('/bracket/:bracketId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, t.name as team_name, t.seed as team_seed,
             g.round, g.region, g.status as game_status, g.winner_id
      FROM picks p
      JOIN teams t ON p.picked_team_id = t.id
      JOIN games g ON p.game_id = g.id
      WHERE p.bracket_id = $1
      ORDER BY g.round, g.region, g.position
    `, [req.params.bracketId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all picks for a game (see who picked what)
router.get('/game/:gameId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, b.name as bracket_name, u.display_name, u.username, t.name as team_name
      FROM picks p
      JOIN brackets b ON p.bracket_id = b.id
      JOIN users u ON b.user_id = u.id
      JOIN teams t ON p.picked_team_id = t.id
      WHERE p.game_id = $1
    `, [req.params.gameId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Leaderboard - all brackets ranked by score
router.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id as bracket_id, b.name as bracket_name,
        u.id as user_id, u.display_name, u.username,
        COALESCE(SUM(p.points_earned), 0) as total_points,
        COUNT(CASE WHEN p.is_correct = true THEN 1 END) as correct_picks,
        COUNT(CASE WHEN p.is_correct = false THEN 1 END) as wrong_picks,
        COUNT(CASE WHEN p.is_correct IS NULL THEN 1 END) as pending_picks,
        COUNT(p.id) as total_picks,
        COALESCE(SUM(CASE WHEN g.round = 1 THEN p.points_earned ELSE 0 END), 0) as r1_points,
        COALESCE(SUM(CASE WHEN g.round = 2 THEN p.points_earned ELSE 0 END), 0) as r2_points,
        COALESCE(SUM(CASE WHEN g.round = 3 THEN p.points_earned ELSE 0 END), 0) as r3_points,
        COALESCE(SUM(CASE WHEN g.round = 4 THEN p.points_earned ELSE 0 END), 0) as r4_points,
        COALESCE(SUM(CASE WHEN g.round = 5 THEN p.points_earned ELSE 0 END), 0) as r5_points,
        COALESCE(SUM(CASE WHEN g.round = 6 THEN p.points_earned ELSE 0 END), 0) as r6_points
      FROM brackets b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN picks p ON b.id = p.bracket_id
      LEFT JOIN games g ON p.game_id = g.id
      GROUP BY b.id, b.name, u.id, u.display_name, u.username
      ORDER BY total_points DESC, correct_picks DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
