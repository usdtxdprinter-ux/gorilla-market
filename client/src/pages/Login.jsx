// client/src/pages/Login.jsx
import { useState } from 'react';
import { useAuth } from '../App';
import { api } from '../api';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { user } = await api.login(username.trim());
      login(user);
    } catch (err) {
      setError(err.message || 'Failed to login');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img
          src="/gorilla-logo.png"
          alt="Vanilla Gorilla"
          style={{
            width: '180px',
            height: '180px',
            objectFit: 'contain',
            margin: '0 auto 20px',
            display: 'block',
            borderRadius: '50%',
            border: '3px solid #ffc82d',
            boxShadow: '0 0 30px rgba(255,200,45,0.2)',
          }}
        />
        <h1 className="login-title">Gorilla Bracket</h1>
        <p className="login-subtitle" style={{
          fontSize: '0.8rem',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-heading)',
          color: '#ffc82d'
        }}>
          Rock Chalk Jayhawk
        </p>
        <p className="login-subtitle">Enter your name to join the bracket pool (10 spots max)</p>
        <form onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="text"
            placeholder="Your name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            maxLength={50}
          />
          <button className="login-btn" type="submit" disabled={loading || !username.trim()}>
            {loading ? 'Joining...' : 'Enter Pool'}
          </button>
        </form>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}
