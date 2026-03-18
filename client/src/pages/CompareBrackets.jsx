// client/src/pages/CompareBrackets.jsx
import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import BracketView from '../components/BracketView';

const REGIONS = ['South', 'West', 'East', 'Midwest', 'Final Four'];

export default function CompareBrackets() {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [allBrackets, setAllBrackets] = useState([]);
  const [selectedBracket, setSelectedBracket] = useState(null);
  const [picks, setPicks] = useState({});
  const [region, setRegion] = useState('South');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [bracketData, brackets] = await Promise.all([api.getBracket(), api.getAllBrackets()]);
      setGames(bracketData);
      setAllBrackets(brackets);
      const mine = brackets.find(b => b.user_id === user.id);
      const first = mine || brackets[0];
      if (first) { setSelectedBracket(first.id); loadPicks(first.id); }
    } catch (err) { console.error('Load error:', err); }
    setLoading(false);
  };

  const loadPicks = async (id) => {
    try {
      const bp = await api.getBracketPicks(id);
      const m = {}; bp.forEach(p => { m[p.game_id] = p.picked_team_id; });
      setPicks(m);
    } catch { setPicks({}); }
  };

  const handleChange = (id) => { setSelectedBracket(id); loadPicks(id); };

  const sel = allBrackets.find(b => b.id === selectedBracket);
  const correct = Object.entries(picks).filter(([gid, tid]) => {
    const g = games.find(x => x.id === +gid);
    return g?.status === 'final' && g.winner_id === tid;
  }).length;
  const wrong = Object.entries(picks).filter(([gid, tid]) => {
    const g = games.find(x => x.id === +gid);
    return g?.status === 'final' && g.winner_id && g.winner_id !== tid;
  }).length;

  if (loading) return <div className="loading"><div className="spinner" /> Loading brackets...</div>;

  return (
    <div>
      <h1 className="page-title">🔍 Compare</h1>
      <p className="page-subtitle">View anyone's bracket picks against live results</p>

      <div className="compare-tabs">
        {allBrackets.map(b => (
          <button key={b.id}
            className={`compare-tab ${selectedBracket === b.id ? 'active' : ''}`}
            onClick={() => handleChange(b.id)}>
            <span style={{ fontWeight: 600 }}>{b.display_name}</span>
            <span style={{ opacity: 0.7, marginLeft: '4px', fontSize: '0.78rem' }}>— {b.name}</span>
            {b.user_id === user.id && <span style={{ marginLeft: '3px', fontSize: '0.7rem', color: 'var(--accent-orange)' }}>★</span>}
          </button>
        ))}
      </div>

      {sel && (
        <div className="info-box">
          <div className="info-box-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '1px' }}>Viewing</div>
              <div style={{ fontWeight: 600, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sel.display_name} — "{sel.name}"
              </div>
            </div>
            <div className="stats-row">
              <div className="stat-block">
                <div className="stat-value" style={{ color: 'var(--accent-orange)' }}>{Object.keys(picks).length}</div>
                <div className="stat-label">Picks</div>
              </div>
              <div className="stat-block">
                <div className="stat-value" style={{ color: 'var(--correct)' }}>{correct}</div>
                <div className="stat-label">Correct</div>
              </div>
              <div className="stat-block">
                <div className="stat-value" style={{ color: 'var(--wrong)' }}>{wrong}</div>
                <div className="stat-label">Wrong</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="region-tabs">
        {REGIONS.map(r => (
          <button key={r} className={`region-tab ${region === r ? 'active' : ''}`}
            onClick={() => setRegion(r)}>{r}</button>
        ))}
      </div>

      <div className="scroll-hint">← Swipe to scroll bracket →</div>
      <BracketView games={games} picks={picks} region={region} showPicks={true} />
    </div>
  );
}
