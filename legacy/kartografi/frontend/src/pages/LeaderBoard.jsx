import { useEffect, useState } from "react";

const CONTINENTS = [
  { id: "all", name: "Open World" },
  { id: "Africa", name: "Africa" },
  { id: "Asia", name: "Asia" },
  { id: "Europe", name: "Europe" },
  { id: "North America", name: "North America" },
  { id: "South America", name: "South America" },
  { id: "Oceania", name: "Oceania" }
];

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gameType, setGameType] = useState("countries");
  const [selectedContinent, setSelectedContinent] = useState("all");
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5050";

  const fetchLeaderboard = async (type, continent) => {
    setLoading(true);
    try {
      let url = `${apiBase}api/leaderboard?gameType=${type}`;
      if (type === "countries" && continent) {
        url += `&continent=${continent}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLeaders(data);
      } else {
        console.error("Failed to fetch leaderboard");
        setLeaders([]);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(gameType, selectedContinent);
  }, [gameType, selectedContinent, apiBase]);

  if (loading) return (
    <div style={{ textAlign: "center", marginTop: 50, color: "#2d2a23" }}>
      Loading leaderboard...
    </div>
  );

  const getRankStyle = (idx) => {
    if (idx === 0) return { background: "#ffd70030" };
    if (idx === 1) return { background: "#c0c0c030" };
    if (idx === 2) return { background: "#cd7f3230" };
    return { background: idx % 2 === 0 ? "#ffffff" : "#f9fafb" };
  };

  return (
    <div className="main-wrap">
      <div className="hero" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "2rem", color: "#2d2a23" }}>🏆 Leaderboards</h1>
        <p style={{ color: "#5d5b53" }}>Compete with players around the world</p>
      </div>

      <div className="map-card">
        <div className="map-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
          <button
            onClick={() => setGameType("countries")}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: gameType === "countries" ? "2px solid #2f6b4f" : "1px solid rgba(0,0,0,.12)",
              background: gameType === "countries" ? "#2f6b4f" : "#fff",
              color: gameType === "countries" ? "#fff" : "#2d2a23",
              cursor: "pointer",
              fontWeight: 600,
              transition: "0.2s all",
            }}
          >
            Countries Quiz
          </button>
          <button
            onClick={() => setGameType("slovenian-cities")}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: gameType === "slovenian-cities" ? "2px solid #2f6b4f" : "1px solid rgba(0,0,0,.12)",
              background: gameType === "slovenian-cities" ? "#2f6b4f" : "#fff",
              color: gameType === "slovenian-cities" ? "#fff" : "#2d2a23",
              cursor: "pointer",
              fontWeight: 600,
              transition: "0.2s all",
            }}
          >
            Slovenian Cities
          </button>

          {gameType === "countries" && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontWeight: 600, color: "#2d2a23" }}>Continent:</label>
              <select
                value={selectedContinent}
                onChange={(e) => setSelectedContinent(e.target.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,.12)",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  background: "#fff",
                  color: "#2d2a23"
                }}
              >
                {CONTINENTS.map(cont => (
                  <option key={cont.id} value={cont.id}>{cont.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead style={{ background: "linear-gradient(135deg, #2f6b4f, #1f456e)", color: "#fff" }}>
              <tr>
                <th style={{ padding: "14px 12px", textAlign: "center", width: "60px" }}>#</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Player</th>
                <th style={{ padding: "14px 12px", textAlign: "center", width: "100px" }}>Score</th>
                <th style={{ padding: "14px 12px", textAlign: "center", width: "100px" }}>Accuracy</th>
                {gameType === "countries" && <th style={{ padding: "14px 12px", textAlign: "center", width: "150px" }}>Continent</th>}
              </tr>
            </thead>
            <tbody>
              {leaders.length === 0 ? (
                <tr>
                  <td colSpan={gameType === "countries" ? 5 : 4} style={{ padding: "40px 20px", textAlign: "center", color: "#5d5b53" }}>
                    No scores yet. Be the first!
                  </td>
                </tr>
              ) : (
                leaders.map((entry, idx) => (
                  <tr key={entry._id} style={{ ...getRankStyle(idx), borderBottom: "1px solid rgba(0,0,0,.06)", transition: "0.2s all" }}>
                    <td style={{ padding: "12px", fontWeight: idx < 3 ? 700 : 500, color: "#2d2a23", textAlign: "center" }}>
                      {idx + 1}{idx === 0 && " 🥇"}{idx === 1 && " 🥈"}{idx === 2 && " 🥉"}
                    </td>
                    <td style={{ padding: "12px", color: "#2d2a23" }}>{entry.username}</td>
                    <td style={{ padding: "12px", fontWeight: 600, textAlign: "center", color: "#2f6b4f" }}>{entry.score}</td>
                    <td style={{ padding: "12px", textAlign: "center", color: "#5d5b53" }}>{entry.percentage}%</td>
                    {gameType === "countries" && <td style={{ padding: "12px", color: "#5d5b53", textAlign: "center" }}>{entry.continent}</td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
