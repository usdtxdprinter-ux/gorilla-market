# 🏀 March Madness Bracket Pool

An interactive NCAA basketball bracket app where your friends can pick their bracket, compare picks, and track live scores on a leaderboard.

**Stack:** Node.js / Express / React (Vite) / PostgreSQL  
**Hosting:** Railway + GitHub

---

## Features

- **Simple Login** — Username-only, no passwords. Just type your name and join.
- **Pick Your Bracket** — Click through all 63 games to pick your winners.
- **Live Master Bracket** — See the actual tournament results as they happen. Auto-refreshes every 30s.
- **Compare Brackets** — View any friend's picks overlaid on the real bracket. Green = correct, red = wrong.
- **Leaderboard** — Live standings with point breakdowns per round.
- **Admin Panel** — Update scores, mark games live, set winners. Winner propagation auto-fills the next round and scores all picks.

### Scoring

| Round | Points |
|-------|--------|
| Round of 64 | 10 |
| Round of 32 | 20 |
| Sweet 16 | 40 |
| Elite 8 | 80 |
| Final Four | 160 |
| Championship | 320 |

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js** 18+ installed
- **PostgreSQL** running locally (or a cloud instance)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/ncaa-bracket.git
cd ncaa-bracket
npm install
cd client && npm install && cd ..
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and set your `DATABASE_URL`:
```
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/ncaa_bracket
```

If you need to create the database first:
```bash
createdb ncaa_bracket
```

### 3. Initialize the Database

This creates all tables and seeds the 64 teams + 63 game slots:

```bash
npm run db:init
```

### 4. Run in Development

In two terminals:

```bash
# Terminal 1 — Backend API
npm run dev:server

# Terminal 2 — Frontend (Vite dev server with hot reload)
npm run dev:client
```

Open **http://localhost:5173** in your browser.

---

## Deploy to Railway + GitHub

### Step 1: Push to GitHub

```bash
# Create a new repo on GitHub, then:
git init
git add .
git commit -m "Initial commit - NCAA Bracket Pool"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ncaa-bracket.git
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"** → choose your `ncaa-bracket` repo
4. Railway will auto-detect the Node.js app

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically creates a `DATABASE_URL` variable
3. Go to your app service → **Variables** tab
4. Click **"Add Reference"** and link the `DATABASE_URL` from the Postgres service
5. Also add: `NODE_ENV` = `production`

### Step 4: Initialize the Database

1. In Railway, go to your app service → **Settings**
2. Under **Deploy**, your app should auto-deploy
3. Open the **Railway shell** (or use the CLI):

```bash
# Using Railway CLI
railway run npm run db:init
```

Or use the Railway web shell to run:
```bash
node server/db/init.js
```

### Step 5: You're Live!

Railway gives you a public URL like `https://ncaa-bracket-production-xxxx.up.railway.app`

Share this URL with your friends!

---

## How to Use

### For Players
1. Open the app URL
2. Type your name to join
3. Go to **"My Bracket"** and click teams to pick winners through every round
4. Click **"Save Bracket"** when done
5. Check **"Standings"** to see how you rank

### For the Admin (You)
As games happen in real life:

1. Go to the **"Admin"** tab
2. Filter to **"Ready to Play"** games
3. Click **"Set Live"** when a game starts
4. Update scores during the game with **"Update Scores"**
5. When the game ends, click the winner button (e.g., "✓ Duke Wins")
6. The app automatically:
   - Propagates the winner to the next round
   - Marks the loser as eliminated
   - Scores every user's pick for that game
   - Updates the leaderboard

---

## Updating Teams

The teams are seeded in `server/db/init.js`. To update for a new year:

1. Edit the `regions` object in the `seedTeams()` function
2. Drop and recreate the database: `dropdb ncaa_bracket && createdb ncaa_bracket`
3. Run `npm run db:init`

---

## Architecture

```
ncaa-bracket/
├── server/
│   ├── index.js          # Express app, serves API + static frontend
│   ├── db/
│   │   ├── pool.js       # PostgreSQL connection pool
│   │   └── init.js       # Database schema + seed script
│   └── routes/
│       ├── auth.js       # Login (username only)
│       ├── games.js      # Bracket data, admin score updates
│       └── picks.js      # User picks, leaderboard
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx       # Router + auth context
│       ├── api.js        # API helper functions
│       ├── components/
│       │   └── BracketView.jsx  # Reusable bracket renderer
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── MyBracket.jsx      # Pick your bracket
│       │   ├── MasterBracket.jsx  # Live results
│       │   ├── CompareBrackets.jsx # View other users' picks
│       │   ├── Leaderboard.jsx    # Standings
│       │   └── Admin.jsx          # Score/winner management
│       └── styles/
│           └── global.css
├── package.json
├── Procfile
└── .env.example
```

## License

MIT — use it however you like. Have fun with March Madness! 🏀
