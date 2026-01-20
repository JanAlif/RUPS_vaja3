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
            Zemljevid
          </NavLink>
          <NavLink to="/quiz" className={navLinkClass}>
            Ugani države
          </NavLink>
          <NavLink to="/sloquiz" className={navLinkClass}>
           Slovenska mesta
          </NavLink>
          <NavLink to="/leaderboards" className={navLinkClass}>
            Lestvice
          </NavLink>
          <NavLink to={"/quiz_geo_ele"} className={navLinkClass}>
            🌍⚡ Geo-Ele kviz
          </NavLink>

          <NavLink to="/powerplantmap" className={navLinkClass}>
            Zemljevid elektrarn
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
                Živijo, <strong>{user.username}</strong>
              </span>
              <button className="btn btn-outline" onClick={logout}>
                Odjava
              </button>
              <NavLink to="/profile" className={navLinkClass}>
                Profil
              </NavLink>
            </>
          ) : (
            <>
              <Link className="btn btn-outline" to="/login">
                Prijava
              </Link>
              <Link className="btn btn-solid" to="/register">
                Registracija
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}