// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const gamesRoutes = require('./routes/games');
const picksRoutes = require('./routes/picks');
const bracketsRoutes = require('./routes/brackets');
const liveScoresRoutes = require('./routes/liveScores');
const { startPolling } = require('./routes/liveScores');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/picks', picksRoutes);
app.use('/api/brackets', bracketsRoutes);
app.use('/api/live', liveScoresRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));

// All other routes serve index.html (React router)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🦍 Gorilla Bracket server running on port ${PORT}`);
  startPolling(60000);
});
