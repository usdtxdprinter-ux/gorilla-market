// client/src/components/BracketView.jsx
// DUMB component - just renders whatever games it receives. No logic.
import { useMemo } from 'react';

const ROUND_NAMES = {
  1: 'Round of 64', 2: 'Round of 32', 3: 'Sweet 16',
  4: 'Elite 8', 5: 'Final Four', 6: 'Championship'
};

function formatOdds(price) {
  if (!price && price !== 0) return '';
  return price > 0 ? `+${price}` : `${price}`;
}

export default function BracketView({ games, picks = {}, onPickTeam, region, showPicks = false, odds = {} }) {
  const regionGames = useMemo(() => {
    if (!games) return {};
    const filtered = games.filter(g => {
      if (region === 'Final Four') return g.round >= 5;
      return g.region === region && g.round <= 4;
    });
    const byRound = {};
    filtered.forEach(g => { if (!byRound[g.round]) byRound[g.round] = []; byRound[g.round].push(g); });
    Object.values(byRound).forEach(arr => arr.sort((a, b) => a.position - b.position));
    return byRound;
  }, [games, region]);

  const rounds = region === 'Final Four' ? [5, 6] : [1, 2, 3, 4];

  return (
    <div className="bracket-container">
      <div className="bracket-grid">
        {rounds.map(round => (
          <div className="bracket-round" key={round}>
            <div className="round-label">{ROUND_NAMES[round]}</div>
            <div className="bracket-games" style={{
              gap: round === 1 ? '4px' : `${Math.pow(2, round - 1) * 8}px`
            }}>
              {(regionGames[round] || []).map(game => (
                <GameCard key={game.id} game={game} pick={picks[game.id]}
                  onPickTeam={onPickTeam} showPicks={showPicks} odds={odds[game.id]} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameCard({ game, pick, onPickTeam, showPicks, odds }) {
  const t1 = game.team1_id;
  const t2 = game.team2_id;
  const team1Pick = pick === t1;
  const team2Pick = pick === t2;
  const gameFinished = game.status === 'final';
  const isLive = game.status === 'live';
  const isPickable = t1 && t2 && game.status === 'upcoming';

  const getClass = (teamId, isPicked) => {
    const c = ['game-team'];
    if (!teamId) return c.join(' ');
    if (game._busted && game._busted.has(teamId)) { c.push('busted'); return c.join(' '); }
    if (gameFinished && game.winner_id === teamId) c.push('winner');
    if (gameFinished && game.winner_id && game.winner_id !== teamId) c.push('loser');
    if (showPicks && isPicked) {
      c.push('picked');
      if (gameFinished) c.push(game.winner_id === teamId ? 'correct' : 'wrong');
    }
    return c.join(' ');
  };

  const handleClick = (teamId) => {
    if (onPickTeam && teamId && isPickable && !(game._busted && game._busted.has(teamId)))
      onPickTeam(game.id, teamId);
  };

  const isBusted = (teamId) => game._busted && game._busted.has(teamId);

  const renderTeam = (teamId, teamName, teamSeed, isPicked, oddsVal, score) => {
    const busted = isBusted(teamId);
    return (
      <div className={getClass(teamId, isPicked)}
        onClick={() => handleClick(teamId)}
        style={{ cursor: onPickTeam && isPickable && !busted ? 'pointer' : 'default' }}>
        {teamId ? (
          <>
            {showPicks && isPicked && !busted && (
              <div className={`pick-indicator ${gameFinished ? (game.winner_id === teamId ? 'correct' : 'wrong') : 'pending'}`} />
            )}
            {busted && <div className="pick-indicator wrong" />}
            <span className="team-seed" style={busted ? { opacity: 0.4 } : undefined}>{teamSeed}</span>
            <span className="team-name" style={busted ? { textDecoration: 'line-through', opacity: 0.4 } : undefined}>{teamName}</span>
            {busted && <span style={{ fontSize: '0.65rem', color: 'var(--wrong)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>OUT</span>}
            {oddsVal != null && !gameFinished && !busted && (
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-heading)', color: oddsVal < 0 ? 'var(--accent-gold)' : 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>
                {formatOdds(oddsVal)}
              </span>
            )}
            {score != null && <span className="team-score">{score}</span>}
          </>
        ) : (
          <span className="team-empty">TBD</span>
        )}
      </div>
    );
  };

  return (
    <div className={`game-card ${isLive ? 'live' : ''}`}>
      {renderTeam(t1, game.team1_name, game.team1_seed, team1Pick, odds?.team1_odds, game.team1_score)}
      {renderTeam(t2, game.team2_name, game.team2_seed, team2Pick, odds?.team2_odds, game.team2_score)}
    </div>
  );
}
