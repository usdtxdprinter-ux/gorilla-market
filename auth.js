// client/src/pages/MyBracket.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { api } from '../api';
import BracketView from '../components/BracketView';

const REGIONS = ['East', 'West', 'Midwest', 'South', 'Final Four'];

export default function MyBracket() {
  const { user } = useAuth();
  const [brackets, setBrackets] = useState([]);
  const [activeBracket, setActiveBracket] = useState(null);
  const [games, setGames] = useState([]);
  const [picks, setPicks] = useState({});
  const [region, setRegion] = useState('East');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { loadBrackets(); }, [user]);

  const loadBrackets = async () => {
    try {
      const [userBrackets, bracketData] = await Promise.all([
        api.getUserBrackets(user.id),
        api.getBracket()
      ]);
      setBrackets(userBrackets);
      setGames(bracketData);
      if (userBrackets.length > 0 && !activeBracket) selectBracket(userBrackets[0]);
    } catch (err) { console.error('Load error:', err); }
    setLoading(false);
  };

  const selectBracket = async (bracket) => {
    setActiveBracket(bracket);
    try {
      const bracketPicks = await api.getBracketPicks(bracket.id);
      const pickMap = {};
      bracketPicks.forEach(p => { pickMap[p.game_id] = p.picked_team_id; });
      setPicks(pickMap);
    } catch (err) { setPicks({}); }
  };

  // When user picks a team, also clear any downstream picks that depended on the old pick
  const handlePick = useCallback((gameId, teamId) => {
    setPicks(prev => {
      const updated = { ...prev, [gameId]: teamId };

      // Build game lookup
      const gameById = {};
      games.forEach(g => { gameById[g.id] = g; });

      // If changing a pick, clear any downstream that had the old team
      const oldPick = prev[gameId];
      if (oldPick && oldPick !== teamId) {
        const clearDownstream = (gId, teamToRemove) => {
          const g = gameById[gId];
          if (!g || !g.next_game_id) return;
          if (updated[g.next_game_id] === teamToRemove) {
            delete updated[g.next_game_id];
            clearDownstream(g.next_game_id, teamToRemove);
          }
        };
        clearDownstream(gameId, oldPick);
      }

      return updated;
    });
  }, [games]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const bracket = await api.createBracket(user.id, newName.trim());
      setNewName(''); setShowCreate(false);
      await loadBrackets();
      selectBracket(bracket);
      flash(`"${bracket.name}" created!`);
    } catch (err) { flash('Error: ' + err.message, true); }
  };

  const handleRename = async (bracketId) => {
    if (!editName.trim()) return;
    try {
      await api.renameBracket(bracketId, editName.trim());
      setEditingId(null); setEditName('');
      loadBrackets();
    } catch (err) { flash('Error: ' + err.message, true); }
  };

  const handleDelete = async (bracketId, name) => {
    if (!window.confirm(`Delete "${name}" and all its picks?`)) return;
    try {
      await api.deleteBracket(bracketId);
      if (activeBracket?.id === bracketId) { setActiveBracket(null); setPicks({}); }
      await loadBrackets();
      flash(`"${name}" deleted`);
    } catch (err) { flash('Error: ' + err.message, true); }
  };

  const handleSave = async () => {
    if (!activeBracket) return;
    setSaving(true);
    try {
      const arr = Object.entries(picks).map(([gid, tid]) => ({ game_id: +gid, picked_team_id: +tid }));
      await api.submitPicks(activeBracket.id, arr);
      flash(`"${activeBracket.name}" saved!`);
      loadBrackets();
    } catch (err) { flash('Error: ' + err.message, true); }
    setSaving(false);
  };

  const flash = (msg, isError = false) => {
    setMessage({ text: msg, error: isError });
    setTimeout(() => setMessage(''), 3000);
  };

  const pickedCount = Object.keys(picks).length;

  if (loading) return <div className="loading"><div className="spinner" /> Loading your brackets...</div>;

  return (
    <div>
      <h1 className="page-title">📋 My Brackets</h1>
      <p className="page-subtitle">Pick winners all the way to the Championship. Your picks automatically fill in future rounds.</p>

      {message && (
        <div className={`message-bar ${message.error ? 'error' : 'success'}`}>{message.text}</div>
      )}

      <div className="bracket-cards">
        {brackets.map(b => (
          <div key={b.id}
            className={`bracket-card ${activeBracket?.id === b.id ? 'active' : ''}`}
            onClick={() => selectBracket(b)}>
            {editingId === b.id ? (
              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '6px' }}>
                <input className="login-input" style={{ marginBottom: 0, padding: '6px 10px', fontSize: '16px' }}
                  value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRename(b.id)} autoFocus />
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.7rem' }}
                  onClick={() => handleRename(b.id)}>Save</button>
              </div>
            ) : (
              <>
                <div className="bracket-card-header">
                  <span className="bracket-card-name">{b.name}</span>
                  <div className="bracket-card-actions" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingId(b.id); setEditName(b.name); }} title="Rename">✏️</button>
                    <button onClick={() => handleDelete(b.id, b.name)} title="Delete">🗑️</button>
                  </div>
                </div>
                <div className="bracket-card-stats">
                  <span><strong style={{ color: 'var(--accent-orange)' }}>{b.pick_count || 0}</strong> picks</span>
                  <span><strong style={{ color: 'var(--accent-green)' }}>{b.total_points || 0}</strong> pts</span>
                  <span style={{ color: 'var(--correct)' }}>{b.correct_picks || 0}✓</span>
                  <span style={{ color: 'var(--wrong)' }}>{b.wrong_picks || 0}✗</span>
                </div>
              </>
            )}
          </div>
        ))}

        {brackets.length < 5 && (
          <div className="bracket-card-new" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? (
              <div style={{ width: '100%' }} onClick={e => e.stopPropagation()}>
                <input className="login-input" style={{ marginBottom: '8px', padding: '10px 12px', fontSize: '16px' }}
                  placeholder='e.g., "Upset Special"' value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  autoFocus maxLength={100} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }}
                    onClick={handleCreate} disabled={!newName.trim()}>Create</button>
                  <button className="btn btn-secondary" style={{ padding: '10px' }}
                    onClick={() => { setShowCreate(false); setNewName(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <span style={{ fontSize: '1.8rem', marginBottom: '4px' }}>+</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  New Bracket ({brackets.length}/5)
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {activeBracket ? (
        <>
          <div style={{ marginBottom: '12px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent-orange)' }}>
              Editing: {activeBracket.name}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {pickedCount}/63 picks — {pickedCount === 63 ? '🎉 Complete!' : `${63 - pickedCount} remaining`}
            </p>
          </div>

          <div className="region-tabs">
            {REGIONS.map(r => (
              <button key={r} className={`region-tab ${region === r ? 'active' : ''}`}
                onClick={() => setRegion(r)}>{r}</button>
            ))}
          </div>

          <div className="scroll-hint">← Swipe to scroll bracket →</div>

          <BracketView games={games} picks={picks} onPickTeam={handlePick} region={region} showPicks={true} />

          <div className="save-bar">
            <span className="pick-count">
              <strong>{activeBracket.name}</strong> — <strong>{pickedCount}</strong>/63
            </span>
            <button className="btn btn-primary" onClick={handleSave}
              disabled={saving || pickedCount === 0}>
              {saving ? 'Saving...' : 'Save Bracket'}
            </button>
          </div>
        </>
      ) : (
        <div className="empty-state">
          {brackets.length === 0 ? 'Create your first bracket to get started!' : 'Select a bracket to edit'}
        </div>
      )}
    </div>
  );
}
