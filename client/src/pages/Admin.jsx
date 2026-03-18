// client/src/pages/Admin.jsx
import { useState, useEffect } from 'react';
import { api } from '../api';

const ROUND_NAMES = {
  1: 'Round of 64', 2: 'Round of 32', 3: 'Sweet 16',
  4: 'Elite 8', 5: 'Final Four', 6: 'Championship'
};

export default function Admin() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [scores, setScores] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => { loadGames(); }, []);

  const loadGames = async () => {
    try {
      const data = await api.getBracket();
      setGames(data);
      // Init scores
      const s = {};
      data.forEach(g => {
        s[g.id] = { team1_score: g.team1_score || 0, team2_score: g.team2_score || 0 };
      });
      setScores(s);
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  };

  const handleSetLive = async (gameId) => {
    try {
      await api.setGameLive(gameId);
      setMessage(`Game #${gameId} is now LIVE`);
      loadGames();
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const handleUpdateScore = async (gameId) => {
    try {
      await api.updateScore(gameId, scores[gameId]);
      setMessage(`Scores updated for game #${gameId}`);
      loadGames();
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const handleSetWinner = async (gameId, winnerId) => {
    if (!window.confirm('Set this team as winner? This will propagate to the next round and score all picks.')) return;
    try {
      await api.setGameResult(gameId, {
        winner_id: winnerId,
        ...scores[gameId]
      });
      setMessage(`Winner set for game #${gameId} — propagated to next round!`);
      loadGames();
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const filteredGames = games.filter(g => {
    if (filter === 'all') return true;
    if (filter === 'playable') return g.team1_id && g.team2_id && g.status !== 'final';
    return g.status === filter;
  }).sort((a, b) => a.round - b.round || a.position - b.position);

  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading admin panel...</div>;
  }

  return (
    <div>
      <h1 className="page-title">⚙️ Admin Panel</h1>
      <p className="page-subtitle">
        Update live scores, set game winners, and manage the tournament bracket.
        Setting a winner automatically propagates to the next round and scores all user picks.
      </p>

      {message && (
        <div style={{
          background: message.includes('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${message.includes('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
          color: message.includes('Error') ? 'var(--accent-red)' : 'var(--accent-green)',
          fontSize: '0.9rem'
        }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="region-tabs" style={{ marginBottom: '20px' }}>
        {[
          ['playable', 'Ready to Play'],
          ['upcoming', 'Upcoming'],
          ['live', 'Live'],
          ['final', 'Completed'],
          ['all', 'All Games']
        ].map(([val, label]) => (
          <button
            key={val}
            className={`region-tab ${filter === val ? 'active' : ''}`}
            onClick={() => setFilter(val)}
          >
            {label}
            <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {games.filter(g => {
                if (val === 'all') return true;
                if (val === 'playable') return g.team1_id && g.team2_id && g.status !== 'final';
                return g.status === val;
              }).length}
            </span>
          </button>
        ))}
      </div>

      {/* Game Cards */}
      {filteredGames.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
          No games match this filter.
        </p>
      ) : (
        filteredGames.map(game => (
          <div className="admin-game" key={game.id}>
            <div className="admin-game-header">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-heading)' }}>
                  #{game.id}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  {ROUND_NAMES[game.round]} • {game.region}
                </span>
                <span className={`badge badge-${game.status === 'final' ? 'final' : game.status === 'live' ? 'live' : 'upcoming'}`}>
                  {game.status === 'live' && '● '}{game.status.toUpperCase()}
                </span>
              </div>
            </div>

            {game.team1_id && game.team2_id ? (
              <>
                <div className="admin-teams">
                  <div className="admin-team">
                    <span className="team-seed">{game.team1_seed}</span>
                    <span style={{ fontWeight: 600, flex: 1 }}>{game.team1_name}</span>
                    <input
                      className="admin-input"
                      type="number"
                      min="0"
                      value={scores[game.id]?.team1_score ?? 0}
                      onChange={(e) => setScores(prev => ({
                        ...prev,
                        [game.id]: { ...prev[game.id], team1_score: parseInt(e.target.value) || 0 }
                      }))}
                      disabled={game.status === 'final'}
                    />
                  </div>
                  <span className="admin-vs">VS</span>
                  <div className="admin-team">
                    <span className="team-seed">{game.team2_seed}</span>
                    <span style={{ fontWeight: 600, flex: 1 }}>{game.team2_name}</span>
                    <input
                      className="admin-input"
                      type="number"
                      min="0"
                      value={scores[game.id]?.team2_score ?? 0}
                      onChange={(e) => setScores(prev => ({
                        ...prev,
                        [game.id]: { ...prev[game.id], team2_score: parseInt(e.target.value) || 0 }
                      }))}
                      disabled={game.status === 'final'}
                    />
                  </div>
                </div>

                {game.status !== 'final' && (
                  <div className="admin-actions">
                    {game.status === 'upcoming' && (
                      <button className="btn btn-secondary" onClick={() => handleSetLive(game.id)}
                        style={{ fontSize: '0.75rem' }}>
                        ● Set Live
                      </button>
                    )}
                    {game.status === 'live' && (
                      <button className="btn btn-secondary" onClick={() => handleUpdateScore(game.id)}
                        style={{ fontSize: '0.75rem' }}>
                        Update Scores
                      </button>
                    )}
                    <button className="btn-winner" onClick={() => handleSetWinner(game.id, game.team1_id)}>
                      ✓ {game.team1_name} Wins
                    </button>
                    <button className="btn-winner" onClick={() => handleSetWinner(game.id, game.team2_id)}>
                      ✓ {game.team2_name} Wins
                    </button>
                  </div>
                )}

                {game.status === 'final' && (
                  <div style={{
                    textAlign: 'center', padding: '8px',
                    color: 'var(--accent-green)', fontSize: '0.85rem',
                    fontFamily: 'var(--font-heading)', textTransform: 'uppercase'
                  }}>
                    Winner: {game.winner_name} ({game.winner_seed})
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', padding: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                Waiting for teams from previous round
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
