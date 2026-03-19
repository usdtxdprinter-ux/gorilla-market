// client/src/pages/MyBracket.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { api } from '../api';
import BracketView from '../components/BracketView';

const REGIONS = ['East', 'West', 'Midwest', 'South', 'Final Four'];

function propagatePicks(rawGames, picks) {
  if (!rawGames.length) return [];

  // Deep copy
  const games = JSON.parse(JSON.stringify(rawGames));
  const byId = {};
  games.forEach(g => { byId[g.id] = g; });

  // Team info
  const teamInfo = {};
  games.forEach(g => {
    if (g.team1_id) teamInfo[g.team1_id] = { name: g.team1_name, seed: g.team1_seed };
    if (g.team2_id) teamInfo[g.team2_id] = { name: g.team2_name, seed: g.team2_seed };
  });

  // Eliminated
  const eliminated = new Set();
  games.forEach(g => {
    if (g.status === 'final' && g.winner_id) {
      if (g.team1_id && g.team1_id !== g.winner_id) eliminated.add(g.team1_id);
      if (g.team2_id && g.team2_id !== g.winner_id) eliminated.add(g.team2_id);
    }
  });

  // Sort by round THEN by game ID (deterministic tiebreaker)
  const sorted = games.slice().sort((a, b) => a.round - b.round || a.id - b.id);

  // Track how many times we've written to each next game
  const slotCounter = {};

  // Walk each game: if user picked a winner, put that team in the next game
  let propagated = 0;
  for (const game of sorted) {
    const pickedId = picks[game.id];
    if (!pickedId) continue;
    if (!game.next_game_id) continue;

    const nextGame = byId[game.next_game_id];
    if (!nextGame) continue;

    const info = teamInfo[pickedId];
    if (!info) continue;

    const count = slotCounter[game.next_game_id] || 0;
    slotCounter[game.next_game_id] = count + 1;

    if (count === 0) {
      nextGame.team1_id = pickedId;
      nextGame.team1_name = info.name;
      nextGame.team1_seed = info.seed;
    } else {
      nextGame.team2_id = pickedId;
      nextGame.team2_name = info.name;
      nextGame.team2_seed = info.seed;
    }
    propagated++;
  }

  console.log(`PROPAGATION: ${Object.keys(picks).length} picks, ${propagated} propagated, ${games.length} games, sample next_game_ids:`, sorted.slice(0,4).map(g => ({ id: g.id, round: g.round, pos: g.position, next: g.next_game_id })));

  // Mark busted
  games.forEach(g => {
    const busted = new Set();
    const raw = rawGames.find(r => r.id === g.id);
    if (g.team1_id && eliminated.has(g.team1_id) && !raw?.team1_id) busted.add(g.team1_id);
    if (g.team2_id && eliminated.has(g.team2_id) && !raw?.team2_id) busted.add(g.team2_id);
    if (busted.size > 0) g._busted = busted;
  });

  return games;
}

export default function MyBracket() {
  const { user } = useAuth();
  const [brackets, setBrackets] = useState([]);
  const [activeBracket, setActiveBracket] = useState(null);
  const [rawGames, setRawGames] = useState([]);
  const [picks, setPicks] = useState({});
  const [region, setRegion] = useState('East');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [odds, setOdds] = useState({});

  // Lock deadline: March 19, 2026 9:00 AM CDT (14:00 UTC)
  const LOCK_DEADLINE = new Date('2026-03-19T14:00:00Z');
  const isLocked = new Date() >= LOCK_DEADLINE;

  // NO useMemo - just compute every render to eliminate caching bugs
  const games = propagatePicks(rawGames, picks);

  useEffect(() => { loadBrackets(); }, [user]);

  const loadBrackets = async () => {
    try {
      const [userBrackets, bracketData, oddsData] = await Promise.all([
        api.getUserBrackets(user.id),
        api.getBracket(),
        api.getOdds().catch(() => ({}))
      ]);
      setBrackets(userBrackets);
      setRawGames(bracketData);
      setOdds(oddsData);

      // DEBUG: check if next_game_id exists
      const r1 = bracketData.filter(g => g.round === 1);
      console.log('R1 games next_game_id check:', r1.slice(0,4).map(g => ({ id: g.id, team1: g.team1_name, next: g.next_game_id })));

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

  const handlePick = useCallback((gameId, teamId) => {
    console.log('PICK:', gameId, teamId);
    setPicks(prev => {
      const updated = { ...prev, [gameId]: teamId };
      const oldPick = prev[gameId];
      if (oldPick && oldPick !== teamId) {
        const gameById = {};
        rawGames.forEach(g => { gameById[g.id] = g; });
        const clearDown = (gId, deadTeam) => {
          const g = gameById[gId];
          if (!g || !g.next_game_id) return;
          if (updated[g.next_game_id] === deadTeam) {
            delete updated[g.next_game_id];
            clearDown(g.next_game_id, deadTeam);
          }
        };
        clearDown(gameId, oldPick);
      }
      console.log('PICKS NOW:', updated);
      return updated;
    });
  }, [rawGames]);

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
    if (!window.confirm('Delete "' + name + '" and all its picks?')) return;
    try {
      console.log('Deleting bracket:', bracketId);
      await api.deleteBracket(bracketId);
      console.log('Deleted successfully');
      setActiveBracket(null);
      setPicks({});
      // Reload brackets list
      const userBrackets = await api.getUserBrackets(user.id);
      setBrackets(userBrackets);
      if (userBrackets.length > 0) {
        selectBracket(userBrackets[0]);
      }
      flash('"' + name + '" deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      flash('Error: ' + err.message, true);
    }
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
      <p className="page-subtitle">Pick winners all the way to the Championship.</p>

      {isLocked && (
        <div className="message-bar error" style={{ marginBottom: '16px' }}>
          🔒 Brackets are locked! Picks closed at 9:00 AM CT on March 19.
        </div>
      )}
      {message && <div className={`message-bar ${message.error ? 'error' : 'success'}`}>{message.text}</div>}
      <div className="bracket-cards">
        {brackets.map(b => (
          <div key={b.id} className={`bracket-card ${activeBracket?.id === b.id ? 'active' : ''}`} onClick={() => selectBracket(b)}>
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
                    <button onClick={() => { setEditingId(b.id); setEditName(b.name); }}>✏️</button>
                    <button onClick={() => handleDelete(b.id, b.name)}>🗑️</button>
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
                  onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus maxLength={100} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={handleCreate} disabled={!newName.trim()}>Create</button>
                  <button className="btn btn-secondary" style={{ padding: '10px' }} onClick={() => { setShowCreate(false); setNewName(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <span style={{ fontSize: '1.8rem', marginBottom: '4px' }}>+</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px' }}>New Bracket ({brackets.length}/5)</span>
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
              <button key={r} className={`region-tab ${region === r ? 'active' : ''}`} onClick={() => setRegion(r)}>{r}</button>
            ))}
          </div>
          <div className="scroll-hint">← Swipe to scroll bracket →</div>
          <BracketView games={games} picks={picks} onPickTeam={isLocked ? null : handlePick} region={region} showPicks={true} odds={odds} />
          <div className="save-bar">
            <span className="pick-count"><strong>{activeBracket.name}</strong> — <strong>{pickedCount}</strong>/63</span>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || pickedCount === 0 || isLocked}>
              {isLocked ? '🔒 Locked' : saving ? 'Saving...' : 'Save Bracket'}
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
