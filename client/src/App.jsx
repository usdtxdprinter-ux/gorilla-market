// client/src/App.jsx
import { useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import Login from './pages/Login';
import MyBracket from './pages/MyBracket';
import MasterBracket from './pages/MasterBracket';
import Leaderboard from './pages/Leaderboard';
import Admin from './pages/Admin';
import CompareBrackets from './pages/CompareBrackets';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const ADMIN_USERNAME = 'timmay';

function Header() {
  const { user, logout } = useAuth();
  const isAdmin = user?.username?.toLowerCase() === ADMIN_USERNAME;
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            <span>🦍</span> Gorilla Bracket
          </div>
          <nav className="header-nav">
            <NavLink to="/my-bracket" className={({ isActive }) => isActive ? 'active' : ''}>My Brackets</NavLink>
            <NavLink to="/master" className={({ isActive }) => isActive ? 'active' : ''}>Live</NavLink>
            <NavLink to="/compare" className={({ isActive }) => isActive ? 'active' : ''}>Compare</NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => isActive ? 'active' : ''}>Standings</NavLink>
            {isAdmin && <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>}
          </nav>
          <div className="header-user">
            <span>Signed in as <strong>{user?.display_name}</strong></span>
            <button className="btn-logout" onClick={logout}>Sign Out</button>
          </div>
        </div>
      </header>
      <nav className="mobile-bottom-nav">
        <NavLink to="/my-bracket" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">📋</span>Brackets
        </NavLink>
        <NavLink to="/master" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">📡</span>Live
        </NavLink>
        <NavLink to="/compare" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">🔍</span>Compare
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">🏆</span>Standings
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">⚙️</span>Admin
          </NavLink>
        )}
      </nav>
    </>
  );
}

function ProtectedRoute({ children, adminOnly }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user?.username?.toLowerCase() !== ADMIN_USERNAME) return <Navigate to="/my-bracket" />;
  return (
    <div className="app-container">
      <Header />
      <div className="page-content">{children}</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('bracket_user');
    return saved ? JSON.parse(saved) : null;
  });
  const login = (userData) => { setUser(userData); sessionStorage.setItem('bracket_user', JSON.stringify(userData)); };
  const logout = () => { setUser(null); sessionStorage.removeItem('bracket_user'); };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/my-bracket" /> : <Login />} />
          <Route path="/my-bracket" element={<ProtectedRoute><MyBracket /></ProtectedRoute>} />
          <Route path="/master" element={<ProtectedRoute><MasterBracket /></ProtectedRoute>} />
          <Route path="/compare" element={<ProtectedRoute><CompareBrackets /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to={user ? "/my-bracket" : "/login"} />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
