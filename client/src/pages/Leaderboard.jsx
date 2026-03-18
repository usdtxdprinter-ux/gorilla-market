// client/src/pages/Leaderboard.jsx
import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function Leaderboard() {
  const { user } = useAuth();
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLeaderboard = async () => {
    try { setStandings(await api.getLeaderboard()); }
    catch (err) { console.error('Leaderboard error:', err); }
    setLoading(false);
  };

  const rankIcon = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
  const rankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';

  if (loading) return <div className="loading"><div className="spinner" /> Loading standings...</div>;

  return (
    <div>
      <h1 className="page-title">🏆 Standings</h1>

      {/* Scoring Guide */}
      <div className="info-box">
        <div className="info-box-row" style={{ gap: '12px', fontSize: '0.82rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.72rem' }}>
            Pts/round:
          </span>
          {[['R64', 10], ['R32', 20], ['S16', 40], ['E8', 80], ['FF', 160], ['🏆', 320]].map(([n, p]) => (
            <span key={n}>
              <strong style={{ color: 'var(--accent-orange)' }}>{n}</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>{p}</span>
            </span>
          ))}
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="empty-state">No brackets submitted yet. Be the first!</div>
      ) : (
        <>
          {/* ── Desktop Table ── */}
          <div className="leaderboard-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th><th>Player</th><th>Bracket</th><th>Points</th>
                  <th>Correct</th><th>Wrong</th><th>Pending</th>
                  <th style={{ fontSize: '0.62rem' }}>R64</th>
                  <th style={{ fontSize: '0.62rem' }}>R32</th>
                  <th style={{ fontSize: '0.62rem' }}>S16</th>
                  <th style={{ fontSize: '0.62rem' }}>E8</th>
                  <th style={{ fontSize: '0.62rem' }}>FF</th>
                  <th style={{ fontSize: '0.62rem' }}>🏆</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, i) => (
                  <tr key={p.bracket_id} style={{
                    outline: p.user_id === user?.id ? '2px solid var(--accent-orange)' : 'none',
                    borderRadius: '8px'
                  }}>
                    <td className={`leaderboard-rank ${rankClass(i)}`}>{rankIcon(i)}</td>
                    <td className="leaderboard-name">
                      {p.display_name}
                      {p.user_id === user?.id && <span style={{ color: 'var(--accent-orange)', fontSize: '0.7rem', marginLeft: '6px' }}>YOU</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontStyle: 'italic' }}>{p.bracket_name}</td>
                    <td className="leaderboard-points">{p.total_points}</td>
                    <td className="stat-correct">{p.correct_picks}</td>
                    <td className="stat-wrong">{p.wrong_picks}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{p.pending_picks}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{p.r1_points}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{p.r2_points}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{p.r3_points}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{p.r4_points}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{p.r5_points}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{p.r6_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="leaderboard-cards">
            {standings.map((p, i) => (
              <div key={p.bracket_id} className={`lb-card ${p.user_id === user?.id ? 'is-you' : ''}`}>
                <div className={`lb-rank ${rankClass(i)}`}>{rankIcon(i)}</div>
                <div className="lb-info">
                  <div className="lb-name">
                    {p.display_name}
                    {p.user_id === user?.id && <span style={{ color: 'var(--accent-orange)', fontSize: '0.7rem', marginLeft: '6px' }}>YOU</span>}
                  </div>
                  <div className="lb-bracket-name">{p.bracket_name}</div>
                  <div className="lb-stats">
                    <span style={{ color: 'var(--correct)' }}>{p.correct_picks}✓</span>
                    <span style={{ color: 'var(--wrong)' }}>{p.wrong_picks}✗</span>
                    <span>{p.pending_picks} pending</span>
                  </div>
                </div>
                <div>
                  <div className="lb-pts">{p.total_points}</div>
                  <div className="lb-pts-label">pts</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
