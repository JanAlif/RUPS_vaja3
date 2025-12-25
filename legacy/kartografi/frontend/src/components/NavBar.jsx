// src/components/NavBar.jsx
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();

  const navLinkClass = ({ isActive }) =>
    "nav-link" + (isActive ? " active" : "");

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-badge" aria-hidden>
            🧭
          </span>
          Kartografi
        </Link>

        <div className="nav-links">
          <NavLink to="/" end className={navLinkClass}>
            Map
          </NavLink>
          <NavLink to="/quiz" className={navLinkClass}>
            Guess countries
          </NavLink>
          <NavLink to="/sloquiz" className={navLinkClass}>
            Guess Slovenian cities
          </NavLink>
          <NavLink to="/leaderboards" className={navLinkClass}>
            Leaderboards
          </NavLink>

          {/* ✅ Elektro modul (samo za prijavljene, ker je /elektro protected) */}
          {user && (
            <NavLink to="/elektro" className={navLinkClass}>
              ⚡ Elektro
            </NavLink>
          )}
        </div>

        <div className="nav-right">
          {user ? (
            <>
              <span style={{ opacity: 0.9 }}>
                hi, <strong>{user.username}</strong>
              </span>
              <button className="btn btn-outline" onClick={logout}>
                Logout
              </button>
              <NavLink to="/profile" className={navLinkClass}>
                Profile
              </NavLink>
            </>
          ) : (
            <>
              <Link className="btn btn-outline" to="/login">
                Login
              </Link>
              <Link className="btn btn-solid" to="/register">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}