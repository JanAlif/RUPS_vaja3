import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      await register({ username: form.username, password: form.password });
      nav("/"); // go home after register
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-badge" aria-hidden>🗺️</div>
          <div className="auth-title">
            <h2>Create your Kartografi account</h2>
            <p>Start mapping your journey</p>
          </div>
        </div>

        <form className="auth-body" onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoFocus
              required
              className="auth-input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="e.g. explorer01"
              autoComplete="username"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <div className="auth-pass">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                required
                className="auth-input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-toggle"
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="confirm">Confirm password</label>
            <div className="auth-pass">
              <input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                required
                className="auth-input"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-toggle"
                onClick={() => setShowConfirm((s) => !s)}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-actions">
            <button className="auth-button" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </button>
          </div>

          <div className="auth-foot">
            <span>Already have an account?</span>
            <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}