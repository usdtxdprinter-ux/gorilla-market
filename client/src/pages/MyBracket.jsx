// client/src/pages/MyBracket.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Build "virtual" games where user picks fill in future rounds
  const virtualGames = useMemo(() => {
    if (!games.length) return [];

    // Deep copy games so we don't mutate the originals
    const vGames = games.map(g => ({ ...g }));
    const gameById = {};
    vGames.forEach(g => { gameById[g.id] = g; });

    // Build a team lookup from all games
    const teamInfo = {};
    vGames.forEach(g => {
      if (g.team1_id) teamInfo[g.team1_id] = { name: g.team1_name, seed: g.team1_seed };
      if (g.team2_id) teamInfo[g.team2_id] = { name: g.team2_name, seed: g.team2_seed };
    });

    // For each pick, propagate the winner into the next game
    // Process in round order so picks cascade correctly
    const sortedGames = [...vGames].sort((a, b) => a.round - b.round || a.position - b.position);

    for (const game of sortedGames) {
      const pickedTeamId = picks[game.id];
      if (!pickedTeamId) continue;
      if (!game.next_game_id) continue;

      const nextGame = gameById[game.next_game_id];
      if (!nextGame) continue;

      // Even position -> fills team1 slot, Odd position -> fills team2 slot
      const info = teamInfo[pickedTeamId];
      if (!info) continue;

      if (game.position % 2 === 0) {
        // Only fill if not already set by actual results
        if (!nextGame.team1_id || nextGame.team1_id === pickedTeamId) {
          nextGame.team1_id = pickedTeamId;
          nextGame.team1_name = info.name;
          nextGame.team1_seed = info.seed;
          teamInfo[pickedTeamId] = info; // ensure it's available for further rounds
        }
      } else {
        if (!nextGame.team2_id || nextGame.team2_id === pickedTeamId) {
          nextGame.team2_id = pickedTeamId;
          nextGame.team2_name = info.name;
          nextGame.team2_seed = info.seed;
          teamInfo[pickedTeamId] = info;
        }
      }
    }

    return vGames;
  }, [games, picks]);

  const handlePick = useCallback((gameId, teamId) => {
    setPicks(prev => {
      const updated = { ...prev, [gameId]: teamId };

      // When a pick changes, clear any downstream picks that depended on the old pick
      // Find the game and trace forward
      const clearDownstream = (gId, oldTeamId) => {
        const game = games.find(g => g.id === gId);
        if (!game || !game.next_game_id) return;
        const nextPick = updated[game.next_game_id];
        if (nextPick === oldTeamId) {
          // The user had picked this team to advance further — clear it
          delete updated[game.next_game_id];
          clearDownstream(game.next_game_id, oldTeamId);
        }
      };

      // If we're changing our pick for this game, clear old downstream
      const oldPick = prev[gameId];
      if (oldPick && oldPick !== teamId) {
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
      <p className="page-subtitle">Pick winners from Round 1 all the way to the Championship. Your picks fill in future rounds automatically.</p>

      {message && (
        <div className={`message-bar ${message.error ? 'error' : 'success'}`}>{message.text}</div>
      )}

      {/* Bracket Cards */}
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

      {/* Bracket Editor */}
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

          <BracketView games={virtualGames} picks={picks} onPickTeam={handlePick} region={region} showPicks={true} />

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
