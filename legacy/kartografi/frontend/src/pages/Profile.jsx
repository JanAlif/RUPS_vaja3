// src/pages/Profile.jsx
import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const AVATAR_COUNT = 14;

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [savingName, setSavingName] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [error, setError] = useState("");

  const [kartografiProfile, setKartografiProfile] = useState(null);
  const [elektroProfile, setElektroProfile] = useState(null);

  const [username, setUsername] = useState("");

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  // ---------- helpers ----------
  const selectedAvatarKey = useMemo(() => {
    const p = elektroProfile?.avatarPath;
    const m = typeof p === "string" ? p.match(/avatar(\d+)/i) : null;
    return m?.[1] ? `avatar${m[1]}` : "avatar1";
  }, [elektroProfile?.avatarPath]);

  // pokaži katerakoli številska polja, ki jih kartografi backend dejansko vrača
  // helper za lepše label-e (optional)
function formatStatLabel(key) {
  const map = {
    points: "Točke",
    quiz_points: "Točke kviza",
    slo_points: "SLO točke",
    // dodaj po potrebi
  };
  return map[key] ?? key.replaceAll("_", " ");
}

// Kartografi numeric stats (brez __v in brez elektro_*)
const kartografiNumericStats = useMemo(() => {
  const k = kartografiProfile || {};
  return Object.entries(k)
    .filter(([key, v]) => {
      if (key === "__v") return false;
      if (key.startsWith("elektro_")) return false; // to gre v Elektro stats
      return typeof v === "number" && Number.isFinite(v);
    })
    .sort(([a], [b]) => a.localeCompare(b));
}, [kartografiProfile]);

  // ---------- initial load ----------
  useEffect(() => {
    if (!user?._id) return;

    (async () => {
      try {
        setLoading(true);
        setError("");

        // 1) Kartografi profil (username, createdAt, + more if backend provides)
        const r1 = await fetch(`/api/users/${user._id}`, { credentials: "include" });
        if (!r1.ok) throw new Error(`Kartografi profile HTTP ${r1.status}`);
        const k = await r1.json();
        setKartografiProfile(k);
        setUsername(k.username ?? "");

        // 2) Elektro profil (avatar + elektro stats)
        const r2 = await fetch(`/api/rups2/users/${user._id}`, { credentials: "include" });
        if (!r2.ok) throw new Error(`Elektro profile HTTP ${r2.status}`);
        const e = await r2.json();
        setElektroProfile(e);
      } catch (e) {
        console.error(e);
        setError("Profila ni bilo mogoče naložiti.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id]);

  // ---------- actions ----------
  async function saveUsername(e) {
    e.preventDefault();
    if (!username?.trim()) return setError("Uporabniško ime ne sme biti prazno.");

    try {
      setSavingName(true);
      setError("");

      const body = JSON.stringify({ username: username.trim() });

      // 1) probaj PATCH
      let res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body,
      });

      // 2) fallback na PUT, če PATCH ni podprt
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`/api/users/${user._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          body,
        });
      }

      if (!res.ok) {
        const msg = await safeMsg(res);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const updated = await res.json();
      setKartografiProfile(updated);

      // sync localStorage za Phaser
      const raw = localStorage.getItem("kartografi:user");
      const baseUser = raw ? JSON.parse(raw) : null;
      if (baseUser) {
        baseUser.username = updated.username;
        localStorage.setItem("kartografi:user", JSON.stringify(baseUser));
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Posodobitev uporabniškega imena ni uspela.");
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (!pwCurrent || !pwNew) return setError("Izpolni vsa polja za geslo.");
    if (pwNew.length < 6) return setError("Novo geslo mora imeti vsaj 6 znakov.");
    if (pwNew !== pwConfirm) return setError("Novi gesli se ne ujemata.");

    try {
      setChangingPw(true);
      setError("");

      const body = JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew });

      // 1) probaj POST
      let res = await fetch(`/api/users/${user._id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body,
      });

      // 2) fallback na PUT
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`/api/users/${user._id}/password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          body,
        });
      }

      if (!res.ok) {
        const msg = await safeMsg(res);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      alert("Geslo je posodobljeno.");
    } catch (e) {
      console.error(e);
      setError(
        e.message?.includes("HTTP 404")
          ? "Pot za spremembo gesla manjka na Kartografi backendu (/api/users/:id/password)."
          : (e.message || "Menjava gesla ni uspela.")
      );
    } finally {
      setChangingPw(false);
    }
  }

  async function deleteAccount() {
    if (!confirm("Želiš izbrisati račun? Tega ni mogoče razveljaviti.")) return;

    try {
      setDeleting(true);
      setError("");

      const res = await fetch(`/api/users/${user._id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const msg = await safeMsg(res);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      await logout?.();
      navigate("/");
    } catch (e) {
      console.error(e);
      setError(
        e.message?.includes("HTTP 404")
          ? "Pot za brisanje manjka na Kartografi backendu (DELETE /api/users/:id)."
          : (e.message || "Brisanje računa ni uspelo.")
      );
    } finally {
      setDeleting(false);
    }
  }

  async function setAvatar(avatarKey) {
    if (!user?._id) return;

    try {
      setSavingAvatar(true);
      setError("");

      const res = await fetch(`/api/rups2/users/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarPath: avatarKey }),
      });

      if (!res.ok) {
        const msg = await safeMsg(res);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const updated = await res.json();
      setElektroProfile(updated);

      // sync localStorage za Phaser
      const raw = localStorage.getItem("kartografi:user");
      const baseUser = raw ? JSON.parse(raw) : null;
      if (baseUser) {
        baseUser.avatarPath = updated.avatarPath;
        localStorage.setItem("kartografi:user", JSON.stringify(baseUser));
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Posodobitev avatarja ni uspela.");
    } finally {
      setSavingAvatar(false);
    }
  }

  // ---------- render ----------
  if (!user) {
    return (
      <div className="main-wrap">
        <div className="map-card" style={{ padding: 16 }}>
          <p>Nisi prijavljen/a.</p>
        </div>
      </div>
    );
  }

  const elektroPoints = elektroProfile?.elektro_points ?? 0;
  const elektroTotal = elektroProfile?.elektro_totalPoints ?? 0;
  const elektroHigh = elektroProfile?.elektro_highScore ?? 0;

  return (
    <div className="main-wrap">
      <div className="map-card">
        <div className="map-toolbar">
          <span className="toolbar-title">Tvoj profil</span>
          <div className="toolbar-spacer" />
          <div style={{ opacity: 0.8 }}>
            Pridružil/a se:{" "}
            {kartografiProfile?.createdAt
              ? new Date(kartografiProfile.createdAt).toLocaleDateString()
              : "—"}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 12px",
              color: "#991b1b",
              background: "#fef2f2",
              borderBottom: "1px solid #fee2e2",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 16 }}>Nalagam ...</div>
        ) : (
          // ✅ IMPORTANT: scroll wrapper (da vidiš password + delete)
          <div style={{ maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
            {/* Overview */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fff" }}>
              <h3 style={{ margin: "0 0 8px" }}>Pregled</h3>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 8, columnGap: 12 }}>
                <div style={{ color: "#64748b" }}>ID uporabnika</div>
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{user._id}</div>

                <div style={{ color: "#64748b" }}>Uporabniško ime</div>
                <div>{kartografiProfile?.username ?? user.username}</div>
              </div>
            </section>

            {/* Kartografi stats (auto-detect numeric fields) */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fbfcfe" }}>
              <h3 style={{ margin: "0 0 10px" }}>Kartografi statistika</h3>

              {kartografiNumericStats.length === 0 ? (
                <div style={{ color: "#64748b" }}>
                  Kartografi backend trenutno ne vrača nobenih številčnih statistik za uporabnika.
                  (Če želiš točke/rezultat tukaj, mora `/api/users/:id` vračati ta polja.)
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", rowGap: 8, columnGap: 12 }}>
                  {kartografiNumericStats.map(([key, val]) => (
                    <Fragment key={key}>
                      <div style={{ color: "#64748b" }}>{formatStatLabel(key)}</div>
                      <div>
                        <strong>{val}</strong>
                      </div>
                    </Fragment>
                  ))}
                </div>
              )}
            </section>

            {/* Elektro stats */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fff" }}>
              <h3 style={{ margin: "0 0 10px" }}>Elektro statistika</h3>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", rowGap: 8, columnGap: 12 }}>
                <div style={{ color: "#64748b" }}>Zadnja seja</div>
                <div>
                  <strong>{elektroPoints}</strong>
                </div>

                <div style={{ color: "#64748b" }}>Skupaj točk</div>
                <div>
                  <strong>{elektroTotal}</strong>
                </div>

                <div style={{ color: "#64748b" }}>Najboljši rezultat</div>
                <div>
                  <strong>{elektroHigh}</strong>
                </div>
              </div>
            </section>

            {/* Avatar picker */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fbfcfe" }}>
              <h3 style={{ margin: "0 0 10px" }}>Izberi avatar</h3>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    border: "3px solid #2563eb",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    background: "#fff",
                  }}
                  title={selectedAvatarKey}
                >
                  <img
                    src={`/src/rups2/avatars/${selectedAvatarKey}.png`}
                    alt={selectedAvatarKey}
                    style={{ width: 64, height: 64, objectFit: "cover" }}
                  />
                </div>
                <div style={{ opacity: 0.85 }}>
                  Izbrano: <strong>{selectedAvatarKey}</strong>
                  {savingAvatar && <span style={{ marginLeft: 8 }}>Shranjujem ...</span>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 56px)", gap: 10 }}>
                {Array.from({ length: AVATAR_COUNT }, (_, i) => {
                  const key = `avatar${i + 1}`;
                  const isSelected = key === selectedAvatarKey;

                  return (
                    <button
                      key={key}
                      type="button"
                      className="tool"
                      onClick={() => setAvatar(key)}
                      disabled={savingAvatar}
                      style={{
                        width: 56,
                        height: 56,
                        padding: 0,
                        borderRadius: 14,
                        borderColor: isSelected ? "#2563eb" : "#e5e7eb",
                        background: "#fff",
                        overflow: "hidden",
                      }}
                      title={key}
                    >
                      <img
                        src={`/src/rups2/avatars/${key}.png`}
                        alt={key}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </button>
                  );
                })}
              </div>

            </section>

            {/* Update username */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fff" }}>
              <h3 style={{ margin: "0 0 10px" }}>Spremeni uporabniško ime</h3>
              <form onSubmit={saveUsername} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="search"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Novo uporabniško ime"
                  style={{ flex: 1, maxWidth: 360 }}
                />
                <button className="tool" disabled={savingName}>
                  {savingName ? "Shranjujem ..." : "Shrani"}
                </button>
              </form>
              <p className="muted" style={{ marginTop: 8 }}>3–50 znakov, unikatno.</p>
            </section>

            {/* Change password */}
            <section style={{ padding: 16, borderBottom: "1px solid #eef0f3", background: "#fbfcfe" }}>
              <h3 style={{ margin: "0 0 10px" }}>Spremeni geslo</h3>
              <form onSubmit={changePassword} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
                <input
                  className="search"
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  placeholder="Trenutno geslo"
                />
                <input
                  className="search"
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="Novo geslo (min 6)"
                />
                <input
                  className="search"
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  placeholder="Potrdi novo geslo"
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tool" disabled={changingPw}>
                    {changingPw ? "Spreminjam ..." : "Posodobi geslo"}
                  </button>
                </div>
              </form>
            </section>

            {/* Danger zone */}
            <section style={{ padding: 16, background: "#fff" }}>
              <h3 style={{ margin: "0 0 8px", color: "#991b1b" }}>Nevarno območje</h3>
              <button
                className="tool"
                style={{ borderColor: "#fecaca", background: "#fff1f2" }}
                onClick={deleteAccount}
                disabled={deleting}
              >
                {deleting ? "Brišem ..." : "Izbriši moj račun"}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

async function safeMsg(res) {
  try {
    const t = await res.text();
    const j = JSON.parse(t);
    return j?.message || t;
  } catch {
    return "";
  }
}