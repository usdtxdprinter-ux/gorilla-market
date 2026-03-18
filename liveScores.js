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
  const { regionGames, resolvedTeams, eliminatedTeams } = useMemo(() => {
    if (!games || !games.length) return { regionGames: {}, resolvedTeams: {}, eliminatedTeams: new Set() };

    const byId = {};
    games.forEach(g => { byId[g.id] = g; });

    const teamInfo = {};
    games.forEach(g => {
      if (g.team1_id) teamInfo[g.team1_id] = { id: g.team1_id, name: g.team1_name, seed: g.team1_seed };
      if (g.team2_id) teamInfo[g.team2_id] = { id: g.team2_id, name: g.team2_name, seed: g.team2_seed };
    });

    // Build set of eliminated teams (lost in a completed game)
    const eliminated = new Set();
    games.forEach(g => {
      if (g.status === 'final' && g.winner_id) {
        if (g.team1_id && g.team1_id !== g.winner_id) eliminated.add(g.team1_id);
        if (g.team2_id && g.team2_id !== g.winner_id) eliminated.add(g.team2_id);
      }
    });

    // Feeder map: which games feed into each game
    const feeders = {};
    games.forEach(g => {
      if (g.next_game_id) {
        if (!feeders[g.next_game_id]) feeders[g.next_game_id] = [];
        feeders[g.next_game_id].push(g);
      }
    });

    const resolved = {};

    function resolveGame(gameId) {
      if (resolved[gameId]) return resolved[gameId];

      const game = byId[gameId];
      if (!game) return { team1: null, team2: null };

      let team1 = game.team1_id ? teamInfo[game.team1_id] : null;
      let team2 = game.team2_id ? teamInfo[game.team2_id] : null;

      // Fill empty slots from user picks in feeder games
      const feederGames = (feeders[gameId] || []).sort((a, b) => a.position - b.position);

      for (const feeder of feederGames) {
        // First resolve the feeder
        resolveGame(feeder.id);

        const pickedTeamId = picks[feeder.id];
        if (!pickedTeamId) continue;

        const pickedTeam = teamInfo[pickedTeamId];
        if (!pickedTeam) continue;

        if (feeder.position % 2 === 0) {
          if (!team1) team1 = pickedTeam;
        } else {
          if (!team2) team2 = pickedTeam;
        }
      }

      resolved[gameId] = { team1, team2 };
      return resolved[gameId];
    }

    games.forEach(g => resolveGame(g.id));

    // Filter by region
    const filtered = games.filter(g => {
      if (region === 'Final Four') return g.round >= 5;
      return g.region === region && g.round <= 4;
    });
    const byRound = {};
    filtered.forEach(g => { if (!byRound[g.round]) byRound[g.round] = []; byRound[g.round].push(g); });
    Object.values(byRound).forEach(arr => arr.sort((a, b) => a.position - b.position));

    return { regionGames: byRound, resolvedTeams: resolved, eliminatedTeams: eliminated };
  }, [games, picks, region]);

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
                  onPickTeam={onPickTeam} showPicks={showPicks} odds={odds[game.id]}
                  resolved={resolvedTeams[game.id]}
                  eliminatedTeams={eliminatedTeams} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameCard({ game, pick, onPickTeam, showPicks, odds, resolved, eliminatedTeams }) {
  const t1 = resolved?.team1;
  const t2 = resolved?.team2;
  const team1Id = t1?.id || game.team1_id;
  const team2Id = t2?.id || game.team2_id;
  const team1Name = t1?.name || game.team1_name;
  const team2Name = t2?.name || game.team2_name;
  const team1Seed = t1?.seed || game.team1_seed;
  const team2Seed = t2?.seed || game.team2_seed;

  const team1Pick = pick === team1Id;
  const team2Pick = pick === team2Id;
  const gameFinished = game.status === 'final';
  const isLive = game.status === 'live';

  // A team shown via pick propagation is "busted" if that team has been eliminated
  // but only for games that haven't actually been played yet
  const team1Busted = !gameFinished && team1Id && eliminatedTeams.has(team1Id) && !game.team1_id;
  const team2Busted = !gameFinished && team2Id && eliminatedTeams.has(team2Id) && !game.team2_id;

  // A game is pickable if both teams are present, not finished, and neither team is busted
  const isPickable = team1Id && team2Id && game.status === 'upcoming' && !team1Busted && !team2Busted;

  const getTeamClass = (teamId, isPicked, isBusted) => {
    const classes = ['game-team'];
    if (!teamId) return classes.join(' ');
    if (isBusted) { classes.push('busted'); return classes.join(' '); }
    if (gameFinished && game.winner_id === teamId) classes.push('winner');
    if (gameFinished && game.winner_id && game.winner_id !== teamId) classes.push('loser');
    if (showPicks && isPicked) {
      classes.push('picked');
      if (gameFinished) classes.push(game.winner_id === teamId ? 'correct' : 'wrong');
    }
    return classes.join(' ');
  };

  const handleClick = (teamId) => {
    if (onPickTeam && teamId && isPickable) {
      onPickTeam(game.id, teamId, game.next_game_id, game.round);
    }
  };

  const renderTeam = (teamId, teamName, teamSeed, isPicked, isBusted, oddsValue, scoreValue, slot) => (
    <div className={getTeamClass(teamId, isPicked, isBusted)}
      onClick={() => handleClick(teamId)}
      style={{ cursor: onPickTeam && isPickable ? 'pointer' : 'default' }}>
      {teamId ? (
        <>
          {showPicks && isPicked && !isBusted && (
            <div className={`pick-indicator ${gameFinished ? (game.winner_id === teamId ? 'correct' : 'wrong') : 'pending'}`} />
          )}
          {isBusted && (
            <div className="pick-indicator wrong" />
          )}
          <span className="team-seed" style={isBusted ? { opacity: 0.4 } : undefined}>{teamSeed}</span>
          <span className="team-name" style={isBusted ? { textDecoration: 'line-through', opacity: 0.4 } : undefined}>
            {teamName}
          </span>
          {isBusted && (
            <span style={{ fontSize: '0.65rem', color: 'var(--wrong)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              OUT
            </span>
          )}
          {oddsValue != null && !gameFinished && !isBusted && (
            <span className="team-odds" style={{
              fontSize: '0.68rem', fontFamily: 'var(--font-heading)',
              color: oddsValue < 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
              minWidth: '36px', textAlign: 'right'
            }}>{formatOdds(oddsValue)}</span>
          )}
          {scoreValue != null && (
            <span className="team-score">{scoreValue}</span>
          )}
        </>
      ) : (
        <span className="team-empty">TBD</span>
      )}
    </div>
  );

  return (
    <div className={`game-card ${isLive ? 'live' : ''} ${(team1Busted && team2Busted) ? 'busted-game' : ''}`}>
      {renderTeam(team1Id, team1Name, team1Seed, team1Pick, team1Busted, odds?.team1_odds, game.team1_score, 1)}
      {renderTeam(team2Id, team2Name, team2Seed, team2Pick, team2Busted, odds?.team2_odds, game.team2_score, 2)}
    </div>
  );
}
