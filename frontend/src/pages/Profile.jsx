// src/pages/Profile.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, setUser, logout } = useAuth(); // assume setUser exists; if not, remove and just refetch
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5050";

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  useEffect(() => {
    if (!user?._id || !apiBase) return;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${apiBase}api/users/${user._id}`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProfile(data);
        setUsername(data.username ?? "");
      } catch (e) {
        console.error(e);
        setError("Could not load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase, user?._id]);

  async function saveUsername(e) {
    e.preventDefault();
    if (!username?.trim()) return setError("Username cannot be empty.");
    try {
      setSavingName(true);
      setError("");
      const res = await fetch(`${apiBase}api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await safeMsg(res);
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setProfile(updated);
      // optionally sync auth context
      setUser?.((u) => ({ ...u, username: updated.username }));
    } catch (e) {
      console.error(e);
      setError(e.message.includes("HTTP 404")
        ? "Update route missing on server (PATCH /api/users/:id)."
        : e.message || "Failed to update username.");
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (!pwCurrent || !pwNew) return setError("Fill out all password fields.");
    if (pwNew.length < 6) return setError("New password must be at least 6 characters.");
    if (pwNew !== pwConfirm) return setError("New passwords do not match.");
    try {
      setChangingPw(true);
      setError("");
      const res = await fetch(`${apiBase}api/users/${user._id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await safeMsg(res);
        throw new Error(msg || `HTTP ${res.status}`);
      }
      // success: clear fields
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      alert("Password updated.");
    } catch (e) {
      console.error(e);
      setError(e.message.includes("HTTP 404")
        ? "Password route missing on server (POST /api/users/:id/password)."
        : e.message || "Failed to change password.");
    } finally {
      setChangingPw(false);
    }
  }

  async function deleteAccount() {
    if (!confirm("Delete your account? This cannot be undone.")) return;
    try {
      setDeleting(true);
      setError("");
      const res = await fetch(`${apiBase}api/users/${user._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await safeMsg(res);
        throw new Error(msg || `HTTP ${res.status}`);
      }
      // log out and go home
      logout?.();
      navigate("/");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  }

  if (!user) {
    return (
      <div className="main-wrap">
        <div className="map-card" style={{ padding: 16 }}>
          <p>You’re not logged in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-wrap">
      <div className="map-card">
        <div className="map-toolbar">
          <span className="toolbar-title">Your profile</span>
          <div className="toolbar-spacer" />
          <div style={{ opacity: 0.8 }}>Joined: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}</div>
        </div>

        {error && (
          <div style={{ padding: "10px 12px", color: "#991b1b", background: "#fef2f2", borderBottom: "1px solid #fee2e2" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 16 }}>Loading…</div>
        ) : (
          <>
            {/* Overview */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fff" }}>
              <h3 style={{ margin: "0 0 8px" }}>Overview</h3>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 8, columnGap: 12 }}>
                <div style={{ color: "#64748b" }}>User ID</div>
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{profile?._id}</div>
                <div style={{ color: "#64748b" }}>Username</div>
                <div>{profile?.username}</div>
                <div style={{ color: "#64748b" }}>Points</div>
                <div><strong>{profile?.points ?? 0}</strong></div>
              </div>
            </section>

            {/* Update username */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fbfcfe" }}>
              <h3 style={{ margin: "0 0 10px" }}>Change username</h3>
              <form onSubmit={saveUsername} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="search"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="New username"
                  style={{ flex: 1, maxWidth: 360 }}
                />
                <button className="tool" disabled={savingName}>{savingName ? "Saving…" : "Save"}</button>
              </form>
              <p className="muted" style={{ marginTop: 8 }}>3–50 characters, unique.</p>
            </section>

            {/* Change password */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fff" }}>
              <h3 style={{ margin: "0 0 10px" }}>Change password</h3>
              <form onSubmit={changePassword} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
                <input
                  className="search"
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  placeholder="Current password"
                />
                <input
                  className="search"
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="New password (min 6)"
                />
                <input
                  className="search"
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  placeholder="Confirm new password"
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tool" disabled={changingPw}>{changingPw ? "Changing…" : "Update password"}</button>
                </div>
              </form>
            </section>

            {/* Danger zone */}
            <section style={{ padding: 16, background: "#fff" }}>
              <h3 style={{ margin: "0 0 8px", color: "#991b1b" }}>Danger zone</h3>
              <button
                className="tool"
                style={{ borderColor: "#fecaca", background: "#fff1f2" }}
                onClick={deleteAccount}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// helper to read server error message safely
async function safeMsg(res) {
  try {
    const t = await res.text();
    const j = JSON.parse(t);
    return j?.message || t;
  } catch {
    return "";
  }
}