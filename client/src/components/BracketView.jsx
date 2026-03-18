// client/src/components/BracketView.jsx
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
  const team1Pick = pick === game.team1_id;
  const team2Pick = pick === game.team2_id;
  const gameFinished = game.status === 'final';
  const isLive = game.status === 'live';

  const getTeamClass = (teamId, isPicked) => {
    const classes = ['game-team'];
    if (!teamId) return classes.join(' ');
    if (gameFinished && game.winner_id === teamId) classes.push('winner');
    if (gameFinished && game.winner_id && game.winner_id !== teamId) classes.push('loser');
    if (showPicks && isPicked) {
      classes.push('picked');
      if (gameFinished) classes.push(game.winner_id === teamId ? 'correct' : 'wrong');
    }
    return classes.join(' ');
  };

  const handleClick = (teamId) => {
    if (onPickTeam && teamId && game.status === 'upcoming') {
      onPickTeam(game.id, teamId, game.next_game_id, game.round);
    }
  };

  return (
    <div className={`game-card ${isLive ? 'live' : ''}`}>
      {/* Team 1 */}
      <div className={getTeamClass(game.team1_id, team1Pick)}
        onClick={() => handleClick(game.team1_id)}
        style={{ cursor: onPickTeam && game.team1_id && game.status === 'upcoming' ? 'pointer' : 'default' }}>
        {game.team1_id ? (
          <>
            {showPicks && team1Pick && (
              <div className={`pick-indicator ${gameFinished ? (game.winner_id === game.team1_id ? 'correct' : 'wrong') : 'pending'}`} />
            )}
            <span className="team-seed">{game.team1_seed}</span>
            <span className="team-name">{game.team1_name}</span>
            {odds?.team1_odds != null && !gameFinished && (
              <span className="team-odds" style={{
                fontSize: '0.68rem', fontFamily: 'var(--font-heading)',
                color: odds.team1_odds < 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
                minWidth: '36px', textAlign: 'right'
              }}>{formatOdds(odds.team1_odds)}</span>
            )}
            {(game.team1_score != null && game.team1_score !== undefined) && (
              <span className="team-score">{game.team1_score}</span>
            )}
          </>
        ) : (
          <span className="team-empty">TBD</span>
        )}
      </div>

      {/* Team 2 */}
      <div className={getTeamClass(game.team2_id, team2Pick)}
        onClick={() => handleClick(game.team2_id)}
        style={{ cursor: onPickTeam && game.team2_id && game.status === 'upcoming' ? 'pointer' : 'default' }}>
        {game.team2_id ? (
          <>
            {showPicks && team2Pick && (
              <div className={`pick-indicator ${gameFinished ? (game.winner_id === game.team2_id ? 'correct' : 'wrong') : 'pending'}`} />
            )}
            <span className="team-seed">{game.team2_seed}</span>
            <span className="team-name">{game.team2_name}</span>
            {odds?.team2_odds != null && !gameFinished && (
              <span className="team-odds" style={{
                fontSize: '0.68rem', fontFamily: 'var(--font-heading)',
                color: odds.team2_odds < 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
                minWidth: '36px', textAlign: 'right'
              }}>{formatOdds(odds.team2_odds)}</span>
            )}
            {(game.team2_score != null && game.team2_score !== undefined) && (
              <span className="team-score">{game.team2_score}</span>
            )}
          </>
        ) : (
          <span className="team-empty">TBD</span>
        )}
      </div>
    </div>
  );
}
