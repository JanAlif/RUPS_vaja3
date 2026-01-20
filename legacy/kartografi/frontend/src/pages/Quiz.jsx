// src/pages/Quiz.jsx
import { useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import QuizMap from "../components/QuizMap";
import countriesGeo from "../assets/countries.json";
import EndGamePopUp from "../components/EndGamePopUp";
import { api } from "../lib/api";

// Helpers to read common Natural Earth props
function featureIso2(f) {
  return (f?.properties?.ISO_A2 || f?.properties?.iso_a2 || "").toUpperCase();
}
function featureName(f) {
  return f?.properties?.NAME || f?.properties?.ADMIN || f?.properties?.name || "Neznano";
}
function featureContinent(f) {
  return f?.properties?.CONTINENT || "Neznano";
}

// Continent definitions
const CONTINENTS = [
  { id: "all", name: "Odprti svet", emoji: "🌍" },
  { id: "Africa", name: "Afrika", emoji: "🌍" },
  { id: "Asia", name: "Azija", emoji: "🌏" },
  { id: "Europe", name: "Evropa", emoji: "🇪🇺" },
  { id: "North America", name: "Severna Amerika", emoji: "🌎" },
  { id: "South America", name: "Južna Amerika", emoji: "🌎" },
  { id: "Oceania", name: "Oceanija", emoji: "🌏" }
];

const MODES = [
  { id: "learning", name: "Način učenja", description: "Vadi brez pritiska" },
  { id: "quiz", name: "Način kviza", description: "10 vprašanj (API + izzivi na zemljevidu)" }
];

const QUESTION_TYPES = [
  { id: "flag", label: "Zastava" },
  { id: "main_city", label: "Glavno mesto" },
  { id: "country", label: "Ime države" },
  { id: "language", label: "Jezik" },
  { id: "map", label: "Izbira na zemljevidu" },
];

const TOTAL_QUIZ_QUESTIONS = 10;
const QUESTION_POINTS = 100;

const defaultTypeSelection = Object.fromEntries(QUESTION_TYPES.map(({ id }) => [id, true]));

export default function Quiz() {
  const mapRef = useRef(null);
  const { user } = useAuth();

  // Game state
  const [gameState, setGameState] = useState("setup"); // "setup", "playing"
  const [selectedContinent, setSelectedContinent] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [typeSelections, setTypeSelections] = useState(defaultTypeSelection);

  // Shared state
  const [score, setScore] = useState(0);
  const [showEndGame, setShowEndGame] = useState(false);

  // Learning mode state
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [feedback, setFeedback] = useState(""); // "", "correct", "wrong"
  const [clickedCountryName, setClickedCountryName] = useState("");
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [learningTarget, setLearningTarget] = useState(null);

  // Quiz mode state
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizQuestionNumber, setQuizQuestionNumber] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizResult, setQuizResult] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizMapSelection, setQuizMapSelection] = useState(null);

  // Derived data
  const availableCountries = useMemo(() => {
    const list = (countriesGeo?.features || []).filter(f => {
      const iso = featureIso2(f);
      if (!iso || iso === "AQ") return false;

      if (selectedContinent === "all") return true;
      if (!selectedContinent) return false;
      return featureContinent(f) === selectedContinent;
    });
    return list;
  }, [selectedContinent]);

  const activeTypes = useMemo(
    () => QUESTION_TYPES.filter(item => typeSelections[item.id]).map(item => item.id),
    [typeSelections]
  );

  const target = useMemo(() => {
    if (selectedMode === "learning") {
      return learningTarget;
    }
    return null;
  }, [selectedMode, learningTarget]);

  const targetName = target ? featureName(target) : "…";

  function toggleType(id) {
    setTypeSelections(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (Object.values(next).some(Boolean)) {
        setQuizError("");
        return next;
      }
      return prev;
    });
  }

  function resetQuizState() {
    setQuizQuestion(null);
    setQuizQuestionNumber(0);
    setQuizAnswer("");
    setQuizResult(null);
    setQuizLoading(false);
    setQuizError("");
    setQuizMapSelection(null);
  }

  function resetLearningState() {
    setSelectedCountry(null);
    setFeedback("");
    setClickedCountryName("");
    setLearningTarget(null);
    setQuestionStartTime(null);
  }

  function resetGame() {
    setGameState("setup");
    setSelectedContinent(null);
    setSelectedMode(null);
    setScore(0);
    setShowEndGame(false);
    resetLearningState();
    resetQuizState();
  }

  async function handleStart() {
    if (!selectedContinent || !selectedMode) return;

    setScore(0);
    setShowEndGame(false);
    resetLearningState();
    resetQuizState();

    if (selectedMode === "learning") {
      if (!availableCountries.length) {
        setQuizError("Za izbrano regijo ni na voljo držav.");
        return;
      }
      const randomIndex = Math.floor(Math.random() * availableCountries.length);
      setLearningTarget(availableCountries[randomIndex]);
      setQuestionStartTime(Date.now());
      setGameState("playing");
      return;
    }

    if (!activeTypes.length) {
      setQuizError("Pred začetkom kviza izberi vsaj eno vrsto vprašanj.");
      return;
    }

    setGameState("playing");
    await loadQuizQuestion(1);
  }

  async function loadQuizQuestion(nextNumber) {
    if (!activeTypes.length) {
      setQuizError("Pred začetkom kviza izberi vsaj eno vrsto vprašanj.");
      return;
    }

    const chosenType = activeTypes[Math.floor(Math.random() * activeTypes.length)];

    setQuizLoading(true);
    setQuizError("");
    setQuizResult(null);
    setQuizAnswer("");
    setQuizMapSelection(null);

    if (chosenType === "map") {
      try {
        const pool = availableCountries.length
          ? availableCountries
          : (countriesGeo?.features || []).filter(feature => {
              const iso = featureIso2(feature);
              return iso && iso !== "AQ";
            });

        if (!pool.length) {
          throw new Error("Za izbrano regijo ni na voljo vprašanj z zemljevidom.");
        }

        const randomIndex = Math.floor(Math.random() * pool.length);
        const feature = pool[randomIndex];
        setQuizQuestionNumber(nextNumber);
        setQuizQuestion({
          type: "map",
          prompt: `Na zemljevidu izberi ${featureName(feature)}.`,
          target: {
            iso: featureIso2(feature),
            name: featureName(feature),
          },
        });
        mapRef.current?.recenter?.();
      } catch (error) {
        setQuizError(error.message || "Priprava vprašanja z zemljevidom ni uspela.");
        setQuizQuestion(null);
      } finally {
        setQuizLoading(false);
      }
      return;
    }

    try {
      const payload = await api.quiz({ question: chosenType });
      setQuizQuestionNumber(nextNumber);
      setQuizQuestion(payload);
    } catch (error) {
      setQuizError(error.message || "Nalagam vprašanje ni uspelo.");
    } finally {
      setQuizLoading(false);
    }
  }

  async function submitQuizAnswer(event) {
    event.preventDefault();
    if (!quizQuestion || quizLoading || quizResult) return;

    if (quizQuestion.type === "map") {
      if (!quizMapSelection) {
        setQuizError("Najprej izberi državo na zemljevidu.");
        return;
      }

      try {
        setQuizLoading(true);
        setQuizError("");
        const selectedIso = featureIso2(quizMapSelection);
        const selectedName = featureName(quizMapSelection);
        const correct = selectedIso === quizQuestion.target.iso;
        setQuizResult({
          type: "map",
          correct,
          info: {
            target: quizQuestion.target.name,
            selected: selectedName,
          },
        });
        if (correct) {
          setScore(prev => prev + QUESTION_POINTS);
        }
      } finally {
        setQuizLoading(false);
      }
      return;
    }

    if (!quizAnswer.trim()) {
      setQuizError("Pred oddajo vpiši odgovor.");
      return;
    }

    try {
      setQuizLoading(true);
      setQuizError("");
      const response = await api.quiz({ question: quizQuestion.questionKey, anwser: quizAnswer });
      setQuizResult(response);
      if (response.correct) {
        setScore(prev => prev + QUESTION_POINTS);
      }
    } catch (error) {
      setQuizError(error.message || "Preverjanje odgovora ni uspelo.");
    } finally {
      setQuizLoading(false);
    }
  }

  async function handleQuizNext() {
    if (!quizResult) return;

    setQuizMapSelection(null);

    if (quizQuestionNumber >= TOTAL_QUIZ_QUESTIONS) {
      await finishQuiz(score);
      return;
    }

    await loadQuizQuestion(quizQuestionNumber + 1);
  }

  async function finishQuiz(finalScore = score) {
    await submitScoreToLeaderboard(finalScore);
    setQuizQuestion(null);
    setQuizResult(null);
    setQuizAnswer("");
    setQuizMapSelection(null);
    setShowEndGame(true);
  }

  const calculateMultiplier = (timeInSeconds) => {
    if (timeInSeconds <= 5) return 1.0;  // 100% of base score
    if (timeInSeconds <= 8) return 0.8;  // 80%
    if (timeInSeconds <= 12) return 0.6; // 60%
    if (timeInSeconds <= 17) return 0.4; // 40%
    if (timeInSeconds <= 25) return 0.2; // 20%
    return 0.1; // 10%
  };

  const handleCountryClick = (feature) => {
    if (selectedMode === "learning") {
      if (feedback || !learningTarget) return;
      setSelectedCountry(feature);
      return;
    }

    if (selectedMode === "quiz" && quizQuestion?.type === "map" && !quizResult) {
      setQuizMapSelection(feature);
      setQuizError("");
    }
  };

  const handleGuess = () => {
    if (selectedMode !== "learning") return;
    if (!selectedCountry || !learningTarget || feedback) return;

    const isoClicked = featureIso2(selectedCountry);
    const isoTarget = featureIso2(learningTarget);
    const clickedName = featureName(selectedCountry);
    const timeElapsed = (Date.now() - questionStartTime) / 1000;

    setClickedCountryName(clickedName);

    if (isoClicked === isoTarget) {
      const multiplier = calculateMultiplier(timeElapsed);
      const points = QUESTION_POINTS * multiplier;
      const newScore = score + points;
      setScore(newScore);
      setFeedback("correct");

      setTimeout(() => {
        nextLearningQuestion(newScore);
      }, 1500);
    } else {
      setFeedback("wrong");

      setTimeout(() => {
        nextLearningQuestion(score);
      }, 1500);
    }
  };

  const nextLearningQuestion = (finalScore = score) => {
    if (selectedMode !== "learning") return;
    setFeedback("");
    setSelectedCountry(null);
    setClickedCountryName("");

    if (!availableCountries.length) {
      return;
    }
    const randomIndex = Math.floor(Math.random() * availableCountries.length);
    setLearningTarget(availableCountries[randomIndex]);
    setQuestionStartTime(Date.now());
    mapRef.current?.recenter();
  };

  const submitScoreToLeaderboard = async (finalScore = score) => {
    if (selectedMode !== "quiz") return;

    try {
      if (!user || !user._id || !user.username) {
        console.log("Not logged in, score not submitted");
        return;
      }

      const maxScore = TOTAL_QUIZ_QUESTIONS * QUESTION_POINTS;
      const percentage = maxScore > 0 ? Math.round((finalScore / maxScore) * 100) : 0;

      const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050").replace(/\/+$/, "");
      const response = await fetch(`${baseUrl}/api/leaderboard/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          userId: user._id,
          username: user.username,
          gameType: "countries",
          continent: selectedContinent,
          score: Math.round(finalScore),
          maxScore,
          percentage
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Score submitted:", data);
        if (data.isNewRecord) {
          console.log("🎉 New high score!");
        }
      } else {
        console.error("Failed to submit score:", await response.text());
      }
    } catch (error) {
      console.error("Failed to submit score:", error);
    }
  };

  function renderQuizQuestionDetails() {
    if (!quizQuestion) return null;

    if (quizQuestion.type === "flag") {
      return (
        <div className="quiz-flag" style={{ margin: "16px 0" }}>
          <img
            src={quizQuestion.data?.flagUrl}
            alt={quizQuestion.data?.flagAlt || "Zastava kviza"}
            style={{ maxWidth: "240px", width: "100%", borderRadius: "8px", border: "1px solid #e5e7eb" }}
          />
        </div>
      );
    }

    if (quizQuestion.type === "map") {
      return (
        <div className="quiz-extra" style={{ marginTop: 12, color: "#4b5563" }}>
          <p style={{ margin: 0 }}>
            Klikni na zemljevid spodaj in izberi <strong>{quizQuestion.target?.name}</strong>.
          </p>
          {quizMapSelection && (
            <p style={{ margin: "4px 0 0", fontSize: "0.95rem" }}>
              Izbrano: {featureName(quizMapSelection)}
            </p>
          )}
        </div>
      );
    }

    if (quizQuestion.type === "language") {
      return (
        <div className="quiz-extra" style={{ marginTop: 12, color: "#4b5563" }}>
          {quizQuestion.data?.languageCount != null && (
            <span>
              Na voljo je {quizQuestion.data.languageCount} uradni
              {quizQuestion.data.languageCount === 1 ? " jezik" : "h jezikov"}.
            </span>
          )}
          {quizQuestion.data?.languageCount > 1 && (
            <span style={{ display: "block", fontSize: "0.9rem" }}>
              Kot pravilen se šteje katerikoli izmed njih.
            </span>
          )}
        </div>
      );
    }

    if (quizQuestion.type === "country" && quizQuestion.data?.language) {
      return (
        <div className="quiz-extra" style={{ marginTop: 12, color: "#4b5563" }}>
          <span>Najdi državo, kjer je <strong>{quizQuestion.data.language}</strong> uraden jezik.</span>
          {quizQuestion.data?.possibleAnswers > 1 && (
            <span style={{ display: "block", fontSize: "0.9rem" }}>
              Veljavnih odgovorov je {quizQuestion.data?.possibleAnswers}.
            </span>
          )}
        </div>
      );
    }

    return null;
  }

  function renderQuizResultDetails() {
    if (!quizResult) return null;

    if (quizResult.type === "country") {
      if (quizResult.correct) {
        return <p>Sprejeta država: {quizResult.info?.matched}</p>;
      }
      return (
        <div>
          <p>Ni zadetka. Nekaj pravilnih odgovorov:</p>
          <ul>
            {(quizResult.info?.acceptableAnswers || []).map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );
    }

    if (quizResult.type === "main_city") {
      const capitals = quizResult.info?.capitals || [];
      return (
        <p>
          {quizResult.correct ? "Pravilno!" : "Skoraj."} Glavno mesto države{" "}
          {quizResult.info?.country ? ` ${quizResult.info.country}` : ""}{" "}
          {capitals.length !== 1 ? "so" : "je"} {capitals.join(", ")}
        </p>
      );
    }

    if (quizResult.type === "language") {
      const languages = quizResult.info?.languages || [];
      return (
        <div>
          <p>{quizResult.correct ? "Odlično!" : "Skoraj."}</p>
          {languages.length > 0 && <p>Uradni jeziki: {languages.join(", ")}</p>}
        </div>
      );
    }

    if (quizResult.type === "flag") {
      return (
        <p>
          {quizResult.correct ? "Pravilno!" : "Ta zastava pripada državi"}{" "}
          {quizResult.info?.country || "vprašane države"}.
        </p>
      );
    }

    if (quizResult.type === "map") {
      return (
        <p>
          {quizResult.correct
            ? "Odlično! Izbral/a si pravo državo."
            : `Izbral/a si ${quizResult.info?.selected || "napačno državo"}. Pravilen odgovor je ${quizResult.info?.target}.`}
        </p>
      );
    }

    return null;
  }

  const quizProgressLabel = `${Math.min(quizQuestionNumber, TOTAL_QUIZ_QUESTIONS)}/${TOTAL_QUIZ_QUESTIONS}`;
  const quizCorrectCount = Math.round(score / QUESTION_POINTS);

  if (gameState === "setup") {
    return (
      <div className="main-wrap">
        <div
          className="setup-container"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
            maxWidth: "900px",
            margin: "0 auto"
          }}
        >
          <h1 style={{ fontSize: "2.5rem", marginBottom: "24px", textAlign: "center" }}>
            🌍 Kviz držav
          </h1>
          <p style={{ marginBottom: "32px", color: "#6b7280" }}>
            Izberi regijo in način. Način kviza pripravi 10 vprašanj iz REST Countries API glede na izbrane teme.
          </p>

          {!selectedContinent && (
            <div style={{ width: "100%" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "20px" }}>Izberi regijo:</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "32px"
                }}
              >
                {CONTINENTS.map(continent => (
                  <button
                    key={continent.id}
                    onClick={() => setSelectedContinent(continent.id)}
                    style={{
                      padding: "24px",
                      fontSize: "1.1rem",
                      background: "#fff",
                      border: "2px solid #e5e7eb",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px"
                    }}
                    className="continent-btn"
                  >
                    <span style={{ fontSize: "2rem" }}>{continent.emoji}</span>
                    <span style={{ fontWeight: "600" }}>{continent.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedContinent && !selectedMode && (
            <div style={{ width: "100%" }}>
              <button
                onClick={() => setSelectedContinent(null)}
                style={{
                  marginBottom: "20px",
                  padding: "8px 16px",
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                ← Nazaj
              </button>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "20px" }}>Izberi način:</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "16px"
                }}
              >
                {MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    style={{
                      padding: "32px",
                      fontSize: "1.1rem",
                      background: "#fff",
                      border: "2px solid #e5e7eb",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left"
                    }}
                    className="mode-btn"
                  >
                    <div style={{ fontWeight: "600", marginBottom: "8px", fontSize: "1.3rem" }}>
                      {mode.name}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "0.95rem" }}>
                      {mode.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedContinent && selectedMode && (
            <div style={{ width: "100%", marginTop: "24px" }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <button
                  onClick={() => setSelectedMode(null)}
                  style={{
                    padding: "8px 16px",
                    background: "#f3f4f6",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  ← Nazaj
                </button>
                <button
                  onClick={() => setSelectedContinent(null)}
                  style={{
                    padding: "8px 16px",
                    background: "#f3f4f6",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  Zamenjaj regijo
                </button>
              </div>

              {selectedMode === "quiz" && (
                <div style={{ marginBottom: "24px" }}>
                  <h3 style={{ marginBottom: "12px" }}>Izberi teme vprašanj:</h3>
                  <div className="quiz-types">
                    {QUESTION_TYPES.map(({ id, label }) => (
                      <label
                        key={id}
                        className={`quiz-type${typeSelections[id] ? " quiz-type--checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={typeSelections[id]}
                          onChange={() => toggleType(id)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <p style={{ marginTop: "12px", fontSize: "0.9rem", color: "#6b7280" }}>
                    Kombiniraš lahko več tipov vprašanj. Kviz bo imel skupaj 10 vprašanj.
                  </p>
                </div>
              )}

              {quizError && (
                <p className="quiz-error" style={{ color: "#dc2626", marginBottom: "12px" }}>{quizError}</p>
              )}

              <button
                onClick={handleStart}
                className="tool"
                style={{
                  padding: "14px 32px",
                  fontSize: "1.1rem",
                  background: "#2563eb",
                  color: "white",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Začni {selectedMode === "quiz" ? "kviz" : "učenje"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedMode === "quiz") {
    return (
      <div className="main-wrap">
        <div className="quiz-card" style={{ maxWidth: "720px", margin: "0 auto", width: "100%" }}>
          <header className="quiz-header" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px"
          }}>
            <div>
              <h1 style={{ margin: 0 }}>Geografski kviz</h1>
              <p style={{ margin: 0, color: "#6b7280" }}>Odgovori na {TOTAL_QUIZ_QUESTIONS} vprašanj (zemljevid + tipkani odgovori).</p>
            </div>
            <div className="quiz-meta" style={{ textAlign: "right" }}>
              <div>Rezultat: <strong>{score}</strong></div>
              <div>Pravilno: {quizCorrectCount}/{TOTAL_QUIZ_QUESTIONS}</div>
              <div>Vprašanje: {quizProgressLabel}</div>
            </div>
          </header>

          <section className="quiz-play" style={{ padding: "24px", background: "#fff" }}>
            {quizError && <p className="quiz-error" style={{ color: "#dc2626" }}>{quizError}</p>}

            {quizQuestion ? (
              <>
                <h2 style={{ marginTop: 0 }}>{quizQuestion.prompt}</h2>
                {renderQuizQuestionDetails()}
                <form
                  onSubmit={submitQuizAnswer}
                  className="quiz-form"
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginTop: "16px",
                    flexDirection: quizQuestion.type === "map" ? "column" : "row",
                    alignItems: quizQuestion.type === "map" ? "flex-start" : "center"
                  }}
                >
                  {quizQuestion.type !== "map" && (
                    <input
                      type="text"
                      value={quizAnswer}
                      disabled={quizLoading || Boolean(quizResult)}
                      onChange={e => setQuizAnswer(e.target.value)}
                      placeholder="Vpiši odgovor ..."
                      style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db" }}
                    />
                  )}
                  <button
                    type="submit"
                    className="tool"
                    disabled={
                      !quizQuestion ||
                      quizLoading ||
                      Boolean(quizResult) ||
                      (quizQuestion.type === "map" ? !quizMapSelection : !quizAnswer.trim())
                    }
                    style={{
                      padding: "12px 24px",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: (
                        !quizQuestion ||
                        quizLoading ||
                        Boolean(quizResult) ||
                        (quizQuestion.type === "map" ? !quizMapSelection : !quizAnswer.trim())
                      ) ? "not-allowed" : "pointer",
                      fontWeight: 600
                    }}
                  >
                    {quizLoading
                      ? "Preverjam ..."
                      : quizQuestion.type === "map"
                        ? "Oddaj izbiro"
                        : "Oddaj"}
                  </button>
                </form>

                {quizQuestion.type === "map" && (
                  <div style={{ marginTop: "16px", height: "360px", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
                    <QuizMap
                      ref={mapRef}
                      zoom={selectedContinent && selectedContinent !== "all" ? 3 : 2}
                      countriesData={countriesGeo}
                      onCountryClick={handleCountryClick}
                      selectedCountry={quizMapSelection}
                    />
                  </div>
                )}

                {quizResult && (
                  <div
                    className={`quiz-feedback ${quizResult.correct ? "quiz-feedback--correct" : "quiz-feedback--wrong"}`}
                    style={{
                      marginTop: "24px",
                      padding: "16px",
                      borderRadius: "10px",
                      background: quizResult.correct ? "#ecfdf5" : "#fee2e2",
                      color: quizResult.correct ? "#065f46" : "#991b1b"
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>
                      {quizResult.correct ? "✅ Pravilno!" : "❌ Napačno."}
                    </h3>
                    {renderQuizResultDetails()}
                    <button
                      className="tool"
                      onClick={handleQuizNext}
                      disabled={quizLoading}
                      style={{
                        marginTop: "12px",
                        padding: "10px 20px",
                        background: "#111827",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: quizLoading ? "not-allowed" : "pointer"
                      }}
                    >
                      {quizQuestionNumber >= TOTAL_QUIZ_QUESTIONS ? "Zaključi kviz" : "Naslednje vprašanje"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p>{quizLoading ? "Nalagam vprašanje ..." : "Vprašanje ni na voljo."}</p>
            )}
          </section>

          <footer className="quiz-footer" style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e7eb",
            background: "#f9fafb",
            borderBottomLeftRadius: "12px",
            borderBottomRightRadius: "12px",
            display: "flex",
            justifyContent: "space-between"
          }}>
            <button className="tool" onClick={resetGame} style={{ padding: "10px 16px" }}>
              Prekliči kviz
            </button>
            <div style={{ fontSize: "0.95rem", color: "#6b7280" }}>
              Pri tekstovnih vprašanjih vpiši ime države; pri zemljevidu izberi državo. Vprašanja o jeziku imajo lahko več veljavnih odgovorov.
            </div>
          </footer>
        </div>

        {showEndGame && (
          <EndGamePopUp
            score={Math.round(score)}
            totalQuestions={TOTAL_QUIZ_QUESTIONS}
            onRestart={() => {
              setShowEndGame(false);
              setScore(0);
              resetQuizState();
              setGameState("setup");
            }}
            onExit={() => {
              setShowEndGame(false);
              resetGame();
            }}
            maxScore={maxScore}
          />
        )}
      </div>
    );
  }

  // Learning (map) mode
  return (
    <div className="main-wrap">
      <div className="map-card">
        <div className="map-toolbar" style={{ borderBottom: "1px solid #eef0f3" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="toolbar-title">Najdi državo:</span>
            <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>{targetName}</span>
          </div>
          <div className="toolbar-spacer" />
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "1.1rem" }}>
              Rezultat: <strong>{Math.round(score)}</strong>
            </div>
            {selectedCountry && !feedback && (
              <button
                className="tool"
                onClick={handleGuess}
                style={{
                  background: "#10b981",
                  color: "white",
                  fontWeight: "600",
                  padding: "8px 20px"
                }}
              >
                ✓ Ugibaj
              </button>
            )}
          </div>
          <button className="tool" onClick={() => mapRef.current?.recenter()}>Ponastavi pogled</button>
          <button className="tool" onClick={resetGame}>Izhod</button>
        </div>

        {feedback && (
          <div
            style={{
              padding: "12px 16px",
              background: feedback === "correct" ? "#ecfdf5" : "#fee2e2",
              color: feedback === "correct" ? "#065f46" : "#991b1b",
              borderBottom: "1px solid #eef0f3",
              fontSize: "1.1rem",
              fontWeight: "600"
            }}
          >
            {feedback === "correct"
              ? `✅ Pravilno! Kliknil/a si ${clickedCountryName}`
              : `❌ Napačno! Kliknil/a si ${clickedCountryName}, pravilen odgovor pa je ${targetName}`}
          </div>
        )}

        {selectedCountry && !feedback && (
          <div
            style={{
              padding: "8px 16px",
              background: "#f3f4f6",
              borderBottom: "1px solid #eef0f3",
              fontSize: "0.95rem"
            }}
          >
            Država izbrana – za potrditev klikni »Ugibaj«
          </div>
        )}

        <div className="map-viewport">
          <QuizMap
            ref={mapRef}
            zoom={2}
            countriesData={countriesGeo}
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountry}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid #eef0f3",
            background: "#fff",
            justifyContent: "flex-end"
          }}
        >
          <button className="tool" onClick={() => mapRef.current?.recenter()}>Reset View</button>
        </div>
      </div>
    </div>
  );
}
