export default function EndGameModal({ score, totalQuestions, onRestart, onExit, highScore, maxScore }) {
  const percentage = (score / maxScore * 100).toFixed(0);
  
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "30px 40px",
          maxWidth: "400px",
          textAlign: "center",
          boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ marginBottom: 16 }}>🎉 Quiz Complete!</h2>
        <p style={{ fontSize: "1.2rem", marginBottom: 24 }}>
          You scored <strong>{score}</strong> out of {maxScore} points
        </p>
        <p style={{ fontSize: "1.1rem", color: "#6b7280", marginBottom: 20 }}>
          {percentage}% correct
        </p>
        {highScore && (
          <p style={{ marginBottom: 20 }}>Your high score: 🏆 <strong>{highScore}</strong></p>
        )}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={onRestart}
            style={{
              padding: "12px 24px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Play Again
          </button>
          <button
            onClick={onExit}
            style={{
              padding: "12px 24px",
              background: "#6b7280",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}