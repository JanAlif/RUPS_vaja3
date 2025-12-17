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
  return f?.properties?.NAME || f?.properties?.ADMIN || f?.properties?.name || "Unknown";
}
function featureContinent(f) {
  return f?.properties?.CONTINENT || "Unknown";
}

// Continent definitions
const CONTINENTS = [
  { id: "all", name: "Open World", emoji: "🌍" },
  { id: "Africa", name: "Africa", emoji: "🌍" },
  { id: "Asia", name: "Asia", emoji: "🌏" },
  { id: "Europe", name: "Europe", emoji: "🇪🇺" },
  { id: "North America", name: "North America", emoji: "🌎" },
  { id: "South America", name: "South America", emoji: "🌎" },
  { id: "Oceania", name: "Oceania", emoji: "🌏" }
];

const MODES = [
  { id: "learning", name: "Learning Mode", description: "Practice without pressure" },
  { id: "quiz", name: "Quiz Mode", description: "10 questions mixing API and map challenges" }
];

const QUESTION_TYPES = [
  { id: "flag", label: "Flag" },
  { id: "main_city", label: "Capital" },
  { id: "country", label: "Name" },
  { id: "language", label: "Language" },
  { id: "map", label: "Map Selection" },
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
        setQuizError("No countries available for the selected region.");
        return;
      }
      const randomIndex = Math.floor(Math.random() * availableCountries.length);
      setLearningTarget(availableCountries[randomIndex]);
      setQuestionStartTime(Date.now());
      setGameState("playing");
      return;
    }

    if (!activeTypes.length) {
      setQuizError("Select at least one question type before starting the quiz.");
      return;
    }

    setGameState("playing");
    await loadQuizQuestion(1);
  }

  async function loadQuizQuestion(nextNumber) {
    if (!activeTypes.length) {
      setQuizError("Select at least one question type before starting the quiz.");
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
          throw new Error("No map questions available for the selected region.");
        }

        const randomIndex = Math.floor(Math.random() * pool.length);
        const feature = pool[randomIndex];
        setQuizQuestionNumber(nextNumber);
        setQuizQuestion({
          type: "map",
          prompt: `Select ${featureName(feature)} on the map.`,
          target: {
            iso: featureIso2(feature),
            name: featureName(feature),
          },
        });
        mapRef.current?.recenter?.();
      } catch (error) {
        setQuizError(error.message || "Failed to prepare map question.");
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
      setQuizError(error.message || "Failed to fetch question.");
    } finally {
      setQuizLoading(false);
    }
  }

  async function submitQuizAnswer(event) {
    event.preventDefault();
    if (!quizQuestion || quizLoading || quizResult) return;

    if (quizQuestion.type === "map") {
      if (!quizMapSelection) {
        setQuizError("Select a country on the map first.");
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
      setQuizError("Enter an answer before submitting.");
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
      setQuizError(error.message || "Failed to check your answer.");
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
            alt={quizQuestion.data?.flagAlt || "Quiz flag"}
            style={{ maxWidth: "240px", width: "100%", borderRadius: "8px", border: "1px solid #e5e7eb" }}
          />
        </div>
      );
    }

    if (quizQuestion.type === "map") {
      return (
        <div className="quiz-extra" style={{ marginTop: 12, color: "#4b5563" }}>
          <p style={{ margin: 0 }}>
            Click on the map below to select <strong>{quizQuestion.target?.name}</strong>.
          </p>
          {quizMapSelection && (
            <p style={{ margin: "4px 0 0", fontSize: "0.95rem" }}>
              Selected: {featureName(quizMapSelection)}
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
              {quizQuestion.data.languageCount} official language
              {quizQuestion.data.languageCount === 1 ? "" : "s"} to choose from.
            </span>
          )}
          {quizQuestion.data?.languageCount > 1 && (
            <span style={{ display: "block", fontSize: "0.9rem" }}>
              Any of them is counted as correct.
            </span>
          )}
        </div>
      );
    }

    if (quizQuestion.type === "country" && quizQuestion.data?.language) {
      return (
        <div className="quiz-extra" style={{ marginTop: 12, color: "#4b5563" }}>
          <span>Find a country where <strong>{quizQuestion.data.language}</strong> is official.</span>
          {quizQuestion.data?.possibleAnswers > 1 && (
            <span style={{ display: "block", fontSize: "0.9rem" }}>
              There are {quizQuestion.data?.possibleAnswers} valid answers.
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
        return <p>Accepted country: {quizResult.info?.matched}</p>;
      }
      return (
        <div>
          <p>No match. Some correct answers:</p>
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
          {quizResult.correct ? "Correct!" : "Not quite."} {quizResult.info?.country ? `${quizResult.info.country}'s` : "The"} capital
          {capitals.length !== 1 ? "s are" : " is"} {capitals.join(", ")}
        </p>
      );
    }

    if (quizResult.type === "language") {
      const languages = quizResult.info?.languages || [];
      return (
        <div>
          <p>{quizResult.correct ? "Great job!" : "Close."}</p>
          {languages.length > 0 && <p>Official languages: {languages.join(", ")}</p>}
        </div>
      );
    }

    if (quizResult.type === "flag") {
      return (
        <p>
          {quizResult.correct ? "Correct!" : "That flag belongs to"} {quizResult.info?.country || "the country in question"}.
        </p>
      );
    }

    if (quizResult.type === "map") {
      return (
        <p>
          {quizResult.correct
            ? "Great job! You picked the right country."
            : `You selected ${quizResult.info?.selected || "the wrong country"}. The correct answer is ${quizResult.info?.target}.`}
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
            🌍 Country Quiz
          </h1>
          <p style={{ marginBottom: "32px", color: "#6b7280" }}>
            Choose a region and mode. Quiz mode pulls 10 questions from the REST Countries API with topics you select.
          </p>

          {!selectedContinent && (
            <div style={{ width: "100%" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "20px" }}>Choose a Region:</h2>
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
                ← Back
              </button>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "20px" }}>Choose a Mode:</h2>
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
                  ← Back
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
                  Change Region
                </button>
              </div>

              {selectedMode === "quiz" && (
                <div style={{ marginBottom: "24px" }}>
                  <h3 style={{ marginBottom: "12px" }}>Select question topics:</h3>
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
                    You can combine multiple types to mix questions. The quiz will pull 10 questions in total.
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
                Start {selectedMode === "quiz" ? "Quiz" : "Learning"}
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
              <h1 style={{ margin: 0 }}>Geography Quiz</h1>
              <p style={{ margin: 0, color: "#6b7280" }}>Answer {TOTAL_QUIZ_QUESTIONS} questions mixing map picks and typed responses.</p>
            </div>
            <div className="quiz-meta" style={{ textAlign: "right" }}>
              <div>Score: <strong>{score}</strong></div>
              <div>Correct: {quizCorrectCount}/{TOTAL_QUIZ_QUESTIONS}</div>
              <div>Question: {quizProgressLabel}</div>
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
                      placeholder="Type your answer…"
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
                      ? "Checking…"
                      : quizQuestion.type === "map"
                        ? "Submit Selection"
                        : "Submit"}
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
                      {quizResult.correct ? "✅ Correct!" : "❌ Incorrect."}
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
                      {quizQuestionNumber >= TOTAL_QUIZ_QUESTIONS ? "Finish Quiz" : "Next Question"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p>{quizLoading ? "Loading question…" : "No question available."}</p>
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
              Cancel Quiz
            </button>
            <div style={{ fontSize: "0.95rem", color: "#6b7280" }}>
              Text prompts expect country names; map prompts require selecting the country on the map. Language questions may have multiple valid answers.
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
            <span className="toolbar-title">Find this country:</span>
            <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>{targetName}</span>
          </div>
          <div className="toolbar-spacer" />
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "1.1rem" }}>
              Score: <strong>{Math.round(score)}</strong>
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
                ✓ Guess
              </button>
            )}
          </div>
          <button className="tool" onClick={() => mapRef.current?.recenter()}>Recenter</button>
          <button className="tool" onClick={resetGame}>Exit</button>
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
              ? `✅ Correct! You clicked ${clickedCountryName}`
              : `❌ Wrong! You clicked ${clickedCountryName}, but the answer was ${targetName}`}
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
            Country selected - Press "Guess" to confirm
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
