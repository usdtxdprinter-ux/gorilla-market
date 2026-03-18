// client/src/api.js
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  login: (username) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username }) }),
  getUsers: () => request('/auth/users'),
  getUserBrackets: (userId) => request(`/brackets/user/${userId}`),
  getAllBrackets: () => request('/brackets/all'),
  createBracket: (userId, name) => request('/brackets', { method: 'POST', body: JSON.stringify({ user_id: userId, name }) }),
  renameBracket: (bracketId, name) => request(`/brackets/${bracketId}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteBracket: (bracketId) => request(`/brackets/${bracketId}`, { method: 'DELETE' }),
  getBracket: () => request('/games/bracket'),
  getTeams: () => request('/games/teams'),
  setGameResult: (gameId, data) => request(`/games/games/${gameId}/result`, { method: 'POST', body: JSON.stringify(data) }),
  setGameLive: (gameId) => request(`/games/games/${gameId}/live`, { method: 'POST' }),
  updateScore: (gameId, data) => request(`/games/games/${gameId}/score`, { method: 'POST', body: JSON.stringify(data) }),
  submitPicks: (bracketId, picks) => request('/picks/submit', { method: 'POST', body: JSON.stringify({ bracket_id: bracketId, picks }) }),
  getBracketPicks: (bracketId) => request(`/picks/bracket/${bracketId}`),
  getGamePicks: (gameId) => request(`/picks/game/${gameId}`),
  getLeaderboard: () => request('/picks/leaderboard'),
  triggerScoreUpdate: () => request('/live/update-scores', { method: 'POST' }),
  getLiveStatus: () => request('/live/status'),
  getOdds: () => request('/live/odds'),
};
