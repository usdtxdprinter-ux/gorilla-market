// server/routes/brackets.js
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

const MAX_BRACKETS_PER_USER = 5;

// Get all brackets for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*,
        COUNT(p.id) as pick_count,
        COALESCE(SUM(p.points_earned), 0) as total_points,
        COUNT(CASE WHEN p.is_correct = true THEN 1 END) as correct_picks,
        COUNT(CASE WHEN p.is_correct = false THEN 1 END) as wrong_picks
      FROM brackets b
      LEFT JOIN picks p ON b.id = p.bracket_id
      GROUP BY b.id
      HAVING b.user_id = $1
      ORDER BY b.created_at
    `, [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get brackets error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new bracket
router.post('/', async (req, res) => {
  try {
    const { user_id, name } = req.body;
    if (!user_id || !name || !name.trim()) {
      return res.status(400).json({ error: 'User ID and bracket name are required' });
    }

    // Check limit
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM brackets WHERE user_id = $1', [user_id]
    );
    if (parseInt(countResult.rows[0].count) >= MAX_BRACKETS_PER_USER) {
      return res.status(403).json({ error: `Maximum ${MAX_BRACKETS_PER_USER} brackets per user` });
    }

    const result = await pool.query(
      'INSERT INTO brackets (user_id, name) VALUES ($1, $2) RETURNING *',
      [user_id, name.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create bracket error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Rename a bracket
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bracket name is required' });
    }
    const result = await pool.query(
      'UPDATE brackets SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bracket not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a bracket (and its picks via CASCADE)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM brackets WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bracket not found' });
    }
    res.json({ success: true, deleted: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all brackets (for compare/leaderboard)
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, u.display_name, u.username
      FROM brackets b
      JOIN users u ON b.user_id = u.id
      ORDER BY u.display_name, b.created_at
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
