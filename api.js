import { useState, useEffect } from 'react';
import { api } from '../api';
import BracketView from '../components/BracketView';

const REGIONS = ['South', 'West', 'East', 'Midwest', 'Final Four'];

export default function MasterBracket() {
  const [games, setGames] = useState([]);
  const [odds, setOdds] = useState({});
  const [region, setRegion] = useState('South');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [bracket, oddsData] = await Promise.all([
        api.getBracket(),
        api.getOdds().catch(() => ({}))
      ]);
      setGames(bracket);
      setOdds(oddsData);
    } catch (err) { console.error('Failed:', err); }
    setLoading(false);
  };

  const liveGames = games.filter(g => g.status === 'live');
  const completed = games.filter(g => g.status === 'final').length;

  if (loading) return <div className="loading"><div className="spinner" /> Loading live bracket...</div>;

  return (
    <div>
      <h1 className="page-title">📡 Live Bracket</h1>

      {liveGames.length > 0 && (
        <div className="info-box" style={{ borderColor: 'rgba(232,0,13,0.3)', background: 'rgba(232,0,13,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="badge badge-live" style={{ animation: 'pulse 1.5s ease infinite' }}>● {liveGames.length} Live</span>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              {liveGames.map(g => (
                <span key={g.id}>
                  <strong>{g.team1_name}</strong> {g.team1_score ?? 0}–{g.team2_score ?? 0} <strong>{g.team2_name}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="page-subtitle">
        {completed}/63 games · Auto-updates scores, winners & moneylines
      </p>

      <div className="region-tabs">
        {REGIONS.map(r => (
          <button key={r} className={`region-tab ${region === r ? 'active' : ''}`} onClick={() => setRegion(r)}>
            {r}
            {r !== 'Final Four' && (
              <span style={{ marginLeft: '5px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {games.filter(g => g.region === r && g.status === 'final').length}/15
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="scroll-hint">← Swipe to scroll bracket →</div>
      <BracketView games={games} region={region} showPicks={false} odds={odds} />
    </div>
  );
}
