// src/components/NavBar.jsx
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-badge" aria-hidden>🧭</span>
          Kartografi
        </Link>

        <div className="nav-links">
          <NavLink to="/" end className={({isActive}) => "nav-link" + (isActive ? " active" : "")}>
            Map
          </NavLink>
          <NavLink to="/quiz" className={({isActive}) => "nav-link" + (isActive ? " active" : "")}>
            Guess countries
          </NavLink>
           <NavLink to="/sloquiz" className={({isActive}) => "nav-link" + (isActive ? " active" : "")}>
            Guess Slovenian cities
          </NavLink>
            <NavLink to="/leaderboards" className={({isActive}) => "nav-link" + (isActive ? " active" : "")}>
            Leaderboards
          </NavLink>

        </div>

        <div className="nav-right">
          {user ? (
            <>
              <span style={{opacity:.9}}>hi, <strong>{user.username}</strong></span>
              <button className="btn btn-outline" onClick={logout}>Logout</button>
              <NavLink to="/profile" className={({isActive}) => "nav-link" + (isActive ? " active" : "")}>
            Profile
          </NavLink>
            </>
          ) : (
            <>
              <Link className="btn btn-outline" to="/login">Login</Link>
              <Link className="btn btn-solid" to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}