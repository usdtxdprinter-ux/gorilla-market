// server/routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Login or register (username only)
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }

    const clean = username.trim().toLowerCase();
    
    // Try to find existing user
    let result = await pool.query('SELECT * FROM users WHERE username = $1', [clean]);
    
    if (result.rows.length === 0) {
      // Check 10-player cap
      const countResult = await pool.query('SELECT COUNT(*) FROM users');
      const MAX_USERS = 10;
      if (parseInt(countResult.rows[0].count) >= MAX_USERS) {
        return res.status(403).json({ error: `Pool is full! Maximum ${MAX_USERS} players allowed.` });
      }
      // Create new user
      result = await pool.query(
        'INSERT INTO users (username, display_name) VALUES ($1, $2) RETURNING *',
        [clean, username.trim()]
      );
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (for leaderboard)
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, display_name, created_at FROM users ORDER BY created_at');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
