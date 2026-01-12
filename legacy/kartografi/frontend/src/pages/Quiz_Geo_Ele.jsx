import { useEffect, useMemo, useRef, useState } from "react";
import QuizMap from "../components/QuizMap";
import countriesGeo from "../assets/countries.json";
import uniBank from "../assets/geo_uni.json";
import bridgeBank from "../assets/geo_country_bridge.json";
import EndGamePopUp from "../components/EndGamePopUp";
import { loadPowerplantsForRegion } from "../lib/powerplants";
import powerplantPlaceholder from "../rups2/components/battery.png";

// --- helpers (Natural Earth) ---
function featureIso2(f) {
  return (f?.properties?.ISO_A2 || f?.properties?.iso_a2 || "").toUpperCase();
}
function featureName(f) {
  return f?.properties?.NAME || f?.properties?.ADMIN || f?.properties?.name || "Unknown";
}
function featureContinent(f) {
  return f?.properties?.CONTINENT || "Unknown";
}

// --- constants ---
const CONTINENTS = [
  { id: "Africa", name: "Africa", emoji: "🌍" },
  { id: "Asia", name: "Asia", emoji: "🌏" },
  { id: "Europe", name: "Europe", emoji: "🇪🇺" },
  { id: "North America", name: "North America", emoji: "🌎" },
  { id: "South America", name: "South America", emoji: "🌎" },
  { id: "Oceania", name: "Oceania", emoji: "🌏" },
];

const TOTAL_QUESTIONS = 6;
const SCORE_QUESTIONS = 6;
const QUESTION_POINTS = 100;
const OUTSIDE_GRID_RESULT_KEY = "geoEleBuildResult";

// ---- TIMER (hard mode) ----
// full points only if you answer extremely fast.
const QUESTION_TIME_LIMIT_SEC = 25; // after this -> minimum score
const MIN_POINTS_PER_QUESTION = 5;  // never 0 if correct, but very low

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// super harsh curve:
// 0-2s: 100%
// 3-5s: 70%
// 6-10s: 40%
// 11-15s: 20%
// 16-25s: 10%
// >25s: 5% (MIN_POINTS_PER_QUESTION)
function pointsByTime(elapsedSec) {
  if (elapsedSec <= 2) return QUESTION_POINTS;
  if (elapsedSec <= 5) return Math.round(QUESTION_POINTS * 0.7);
  if (elapsedSec <= 10) return Math.round(QUESTION_POINTS * 0.4);
  if (elapsedSec <= 15) return Math.round(QUESTION_POINTS * 0.2);
  if (elapsedSec <= QUESTION_TIME_LIMIT_SEC) return Math.round(QUESTION_POINTS * 0.1);
  return MIN_POINTS_PER_QUESTION;
}

export default function Quiz_Geo_Ele() {
  const mapRef = useRef(null);

  // setup
  const [gameState, setGameState] = useState("setup"); // setup | playing
  const [selectedContinent, setSelectedContinent] = useState(null);

  // shared
  const [score, setScore] = useState(0);
  const [showEndGame, setShowEndGame] = useState(false);

  // quiz state
  const [questionNumber, setQuestionNumber] = useState(0);
  const [question, setQuestion] = useState(null); // { type: "mcq"|"map", prompt, ... }
  const [answer, setAnswer] = useState(""); // mcq index string
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // map selection
  const [mapSelection, setMapSelection] = useState(null);

  // Used Q1–Q3 (uni) ids
  const [usedUniIds, setUsedUniIds] = useState([]);

  // Bridge picks (for circuits)
  const [bridgeQ4, setBridgeQ4] = useState(null);
  const [bridgeQ5, setBridgeQ5] = useState(null);
  const [powerplants, setPowerplants] = useState([]);
  const [selectedPowerplant, setSelectedPowerplant] = useState(null);

  // --- timer state ---
  const [questionStartedAt, setQuestionStartedAt] = useState(null); // ms
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT_SEC);

  const maxScore = SCORE_QUESTIONS * QUESTION_POINTS;

  const availableCountries = useMemo(() => {
    const list = (countriesGeo?.features || []).filter((f) => {
      const iso = featureIso2(f);
      if (!iso || iso === "AQ") return false;
      return selectedContinent ? featureContinent(f) === selectedContinent : false;
    });
    return list;
  }, [selectedContinent]);

  const bridgeQuestionsForContinent = useMemo(() => {
    const all = Array.isArray(bridgeBank) ? bridgeBank : [];
    return all.filter((q) => q?.continent === selectedContinent);
  }, [selectedContinent]);

  useEffect(() => {
    if (!selectedContinent) return;
    loadPowerplantsForRegion(selectedContinent)
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        setPowerplants(list);
        if (!selectedPowerplant && list.length) {
          setSelectedPowerplant(list[Math.floor(Math.random() * list.length)]);
        }
        if (list.length === 0) {
          setError("No powerplant data available for this region.");
        }
      })
      .catch(() => {
        setError("Failed to load powerplant data.");
      });
  }, [selectedContinent]);

  // --- timer tick ---
  useEffect(() => {
    if (gameState !== "playing") return;
    if (!question || result) return;
    if (!questionStartedAt) return;

    const id = setInterval(() => {
      const elapsedSec = (Date.now() - questionStartedAt) / 1000;
      const left = Math.max(0, QUESTION_TIME_LIMIT_SEC - Math.floor(elapsedSec));
      setTimeLeft(left);
    }, 250);

    return () => clearInterval(id);
  }, [gameState, question, result, questionStartedAt]);

  function resetAll() {
    setGameState("setup");
    setSelectedContinent(null);

    setScore(0);
    setShowEndGame(false);

    setQuestionNumber(0);
    setQuestion(null);
    setAnswer("");
    setResult(null);
    setLoading(false);
    setError("");

    setMapSelection(null);

    setUsedUniIds([]);
    setBridgeQ4(null);
    setBridgeQ5(null);
    setPowerplants([]);
    setSelectedPowerplant(null);

    // timer reset
    setQuestionStartedAt(null);
    setTimeLeft(QUESTION_TIME_LIMIT_SEC);
  }

  function pickGeneralUniQuestion() {
    const all = Array.isArray(uniBank?.questions) ? uniBank.questions : [];
    if (!all.length) return null;

    const unused = all.filter((q) => q?.id && !usedUniIds.includes(q.id));
    const pool = unused.length ? unused : all;
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  function pickBridgePair() {
    const pool = bridgeQuestionsForContinent;
    if (!pool || pool.length < 2) return { q4: null, q5: null };
    const shuffled = shuffle(pool);
    return { q4: shuffled[0], q5: shuffled[1] };
  }

  function findFeatureByIso2(iso2) {
    const features = countriesGeo?.features || [];
    const upper = String(iso2 || "").toUpperCase();
    return features.find((f) => featureIso2(f) === upper) || null;
  }

  async function startRun() {
    if (!selectedContinent) return;

    if (!availableCountries.length) {
      setError("No countries available for the selected continent.");
      return;
    }

    if (!Array.isArray(uniBank?.questions) || uniBank.questions.length < 3) {
      setError("geo_uni.json must contain at least 3 questions.");
      return;
    }

    if (!bridgeQuestionsForContinent || bridgeQuestionsForContinent.length < 2) {
      setError("geo_country_bridge.json must contain at least 2 questions for the selected continent.");
      return;
    }

    const { q4, q5 } = pickBridgePair();
    setBridgeQ4(q4);
    setBridgeQ5(q5);

    setScore(0);
    setShowEndGame(false);
    setUsedUniIds([]);
    setMapSelection(null);

    setGameState("playing");
    await loadQuestion(1, { q4, q5 });
  }

  async function loadQuestion(nextNumber, prePicked = null) {
    setLoading(true);
    setError("");
    setResult(null);
    setAnswer("");
    setMapSelection(null);

    try {
      // Q1–Q3: uni MCQ
      if (nextNumber >= 1 && nextNumber <= 3) {
        const q = pickGeneralUniQuestion();
        if (!q) throw new Error("No university questions found in geo_uni.json.");

        if (q?.id) setUsedUniIds((prev) => (prev.includes(q.id) ? prev : [...prev, q.id]));

        setQuestionNumber(nextNumber);
        setQuestion({
          type: "mcq",
          prompt: q.prompt,
          data: { choices: q.choices || [] },
          correctIndex: q.answerIndex,
          meta: {
            explanation: q.explanation,
            category: q.category,
            difficulty: q.difficulty,
          },
        });

        // start timer
        setQuestionStartedAt(Date.now());
        setTimeLeft(QUESTION_TIME_LIMIT_SEC);
        return;
      }

      const q4 = prePicked?.q4 || bridgeQ4;
      const q5 = prePicked?.q5 || bridgeQ5;

      // Q4: MAP geoguesser based on bridge question's countryIso2
      if (nextNumber === 4) {
        if (!q4?.countryIso2) throw new Error("Bridge Q4 missing countryIso2.");

        const feature = findFeatureByIso2(q4.countryIso2);
        if (!feature) {
          throw new Error(`Country ISO2 ${q4.countryIso2} not found in countries.json (Natural Earth).`);
        }

        setQuestionNumber(nextNumber);
        setQuestion({
          type: "map",
          prompt: `Q4 (GeoGuess): Klikni državo na zemljevidu.`,
          target: { iso2: q4.countryIso2, name: featureName(feature) },
          meta: { bridgeId: q4.id, elecProfile: q4.elecProfile, explanation: q4.explanation },
        });

        mapRef.current?.recenter?.();

        // start timer
        setQuestionStartedAt(Date.now());
        setTimeLeft(QUESTION_TIME_LIMIT_SEC);
        return;
      }

      // Q5: MCQ from bridge question (includes elecProfile)
      if (nextNumber === 5) {
        if (!q5?.choices?.length || q5.answerIndex == null) {
          throw new Error("Bridge Q5 invalid (missing choices/answerIndex).");
        }

        setQuestionNumber(nextNumber);
        setQuestion({
          type: "mcq",
          prompt: `Q5 (Country + Energy): ${q5.prompt}`,
          data: { choices: q5.choices },
          correctIndex: q5.answerIndex,
          meta: {
            explanation: q5.explanation,
            category: `bridge:${q5.continent}`,
            difficulty: 5,
            bridgeId: q5.id,
            countryIso2: q5.countryIso2,
            elecProfile: q5.elecProfile,
          },
        });

        // start timer
        setQuestionStartedAt(Date.now());
        setTimeLeft(QUESTION_TIME_LIMIT_SEC);
        return;
      }

      // Q6: build circuit in workspace for a specific powerplant
      if (nextNumber === 6) {
        const region = selectedContinent;
        let list = powerplants;
        if (!Array.isArray(list) || !list.length) {
          list = await loadPowerplantsForRegion(region);
        }
        if (!Array.isArray(list) || !list.length) {
          throw new Error("No powerplant data available for this region.");
        }

        const picked = selectedPowerplant || list[Math.floor(Math.random() * list.length)];
        setSelectedPowerplant(picked);

        const powerplantPayload = {
          region,
          name: picked.name,
          type: picked.type,
          coolingNeeds: picked.coolingNeeds,
          capacityMW: picked.capacityMW,
          constraints: picked.constraints || [],
          meta: picked.meta || {},
        };

        localStorage.setItem("geoElePowerplant", JSON.stringify(powerplantPayload));

        setQuestionNumber(nextNumber);
        setQuestion({
          type: "build",
          prompt: `Q6 (Build): Zgradi električni krog za elektrarno "${picked.name}".`,
          data: { placeholderImg: powerplantPlaceholder },
          meta: { powerplant: powerplantPayload },
        });

        // start timer
        setQuestionStartedAt(Date.now());
        setTimeLeft(QUESTION_TIME_LIMIT_SEC);
        return;
      }
    } catch (e) {
      setQuestion(null);
      setError(e?.message || "Failed to load question.");
    } finally {
      setLoading(false);
    }
  }

  function elapsedSeconds() {
    if (!questionStartedAt) return 0;
    return (Date.now() - questionStartedAt) / 1000;
  }

  async function submitAnswer(e) {
    e.preventDefault();
    if (!question || loading || result) return;

    const elapsedSec = elapsedSeconds();

    // MCQ
    if (question.type === "mcq") {
      if (answer === "") {
        setError("Select an option first.");
        return;
      }

      const picked = Number(answer);
      const correct = picked === question.correctIndex;

      let gained = 0;
      if (correct) gained = pointsByTime(elapsedSec);

      setResult({
        correct,
        info: {
          correctLabel: question.data?.choices?.[question.correctIndex],
          pickedLabel: question.data?.choices?.[picked],
          explanation: question.meta?.explanation,
          category: question.meta?.category,
          difficulty: question.meta?.difficulty,
          elapsedSec: Math.round(elapsedSec * 10) / 10,
          gained,
        },
      });

      if (correct) setScore((prev) => prev + gained);
      console.log("[quiz] scoring", {
        questionType: "mcq",
        correct,
        elapsedSec: Math.round(elapsedSec * 10) / 10,
        gained,
      });
      return;
    }

    // MAP (Q4)
    if (question.type === "map") {
      if (!mapSelection) {
        setError("Click a country on the map first.");
        return;
      }

      const selectedIso = featureIso2(mapSelection);
      const correct = selectedIso === question.target.iso2;

      let gained = 0;
      if (correct) gained = pointsByTime(elapsedSec);

      setResult({
        correct,
        info: {
          target: question.target.name,
          selected: featureName(mapSelection),
          explanation: question.meta?.explanation,
          elapsedSec: Math.round(elapsedSec * 10) / 10,
          gained,
        },
      });

      if (correct) setScore((prev) => prev + gained);
      console.log("[quiz] scoring", {
        questionType: "map",
        correct,
        elapsedSec: Math.round(elapsedSec * 10) / 10,
        gained,
        target: question.target?.name,
        selected: featureName(mapSelection),
      });
      return;
    }

    if (question.type === "build") {
      let buildResult = null;
      try {
        buildResult = JSON.parse(localStorage.getItem(OUTSIDE_GRID_RESULT_KEY) || "null");
      } catch {
        buildResult = null;
      }

      if (!buildResult) {
        setError("Oddaj omrežje v Elektro najprej (Submit).");
        return;
      }

      const buildPlantName = buildResult?.powerplant?.name;
      const expectedPlantName = question.meta?.powerplant?.name;
      if (buildPlantName && expectedPlantName && buildPlantName !== expectedPlantName) {
        setError("Oddano omrežje ni za izbrano elektrarno.");
        return;
      }

      // Score the build using the quiz timer so points align with other questions.
      const correct = Boolean(buildResult?.correct);
      const capacityMatch = Boolean(buildResult?.cityInfo?.capacityMatch);
      const insideMatch = Boolean(buildResult?.insideMatch);
      const gained = correct && capacityMatch && insideMatch ? pointsByTime(elapsedSec) : 0;

      setResult({
        correct,
        info: {
          elapsedSec: Math.round(elapsedSec * 10) / 10,
          gained,
          powerplant: question.meta?.powerplant || null,
          missing: buildResult?.requirements?.missing || [],
          cityInfo: buildResult?.cityInfo || null,
          insideResult: buildResult?.insideResult || null,
          insideMatch,
          capacityMatch,
        },
      });

      if (correct) setScore((prev) => prev + gained);
      console.log("[quiz] scoring", {
        questionType: "build",
        correct,
        gained,
        elapsedSec: Math.round(elapsedSec * 10) / 10,
        capacityMatch,
        insideMatch,
        requiredCities: buildResult?.cityInfo?.requiredCities,
        connectedCities: buildResult?.cityInfo?.connectedCities,
        insideOutputMW: buildResult?.insideResult?.outputMW,
        powerplantCapacityMW: question.meta?.powerplant?.capacityMW,
        missing: buildResult?.requirements?.missing || [],
      });
      return;
    }
  }

  async function next() {
    if (!result) return;

    if (questionNumber >= TOTAL_QUESTIONS) {
      finish();
      return;
    }

    await loadQuestion(questionNumber + 1);
  }

  function finish() {
    try {
      const q4 = bridgeQ4;
      const q5 = bridgeQ5;

      const payload = {
        geoScore: Math.round(score),
        maxScore,
        continent: selectedContinent,
        finishedAt: Date.now(),
        circuit1: q4 ? { bridgeId: q4.id, countryIso2: q4.countryIso2, elecProfile: q4.elecProfile || null } : null,
        circuit2: q5 ? { bridgeId: q5.id, countryIso2: q5.countryIso2, elecProfile: q5.elecProfile || null } : null,
        powerplant: selectedPowerplant || null,
      };

      localStorage.setItem("geoEleRun", JSON.stringify(payload));
    } catch {
      // ignore
    }

    setShowEndGame(true);
  }

  function onCountryClick(feature) {
    if (question?.type !== "map" || result) return;
    setMapSelection(feature);
    setError("");
  }

  // --- UI ---
  if (gameState === "setup") {
    return (
      <div className="main-wrap">
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            padding: "40px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <h1 style={{ margin: 0 }}>🎓 Geo → Ele Challenge</h1>
          <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.5 }}>
            Run ima <strong>5 vprašanj</strong>:
            <br />
            <strong>Q1–Q3</strong> = univerzitetna geografija (MCQ) · <strong>Q4</strong> = GeoGuess (map) ·{" "}
            <strong>Q5</strong> = država + energija (MCQ). <br />
            Točke padajo <strong>zelo hitro</strong> (hard mode).
          </p>

          {!selectedContinent ? (
            <div>
              <h2 style={{ fontSize: "1.2rem", margin: "16px 0 10px" }}>Choose a Continent:</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {CONTINENTS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContinent(c.id)}
                    style={{
                      padding: 18,
                      borderRadius: 12,
                      border: "2px solid #e5e7eb",
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 26 }}>{c.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div style={{ color: "#6b7280", fontSize: "0.95rem" }}>Q4/Q5 bosta iz tega kontinenta</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => setSelectedContinent(null)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  cursor: "pointer",
                }}
              >
                ← Change continent
              </button>

              <button
                onClick={startRun}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Start 5-question run
              </button>
            </div>
          )}

          {error && <div style={{ color: "#dc2626", fontWeight: 600 }}>{error}</div>}

          <div style={{ color: "#6b7280", fontSize: "0.95rem" }}>
            Po koncu: <code>localStorage.geoEleRun</code> (circuit1 + circuit2).
          </div>
        </div>
      </div>
    );
  }

  const progressLabel = `${Math.min(questionNumber, TOTAL_QUESTIONS)}/${TOTAL_QUESTIONS}`;
  const previewGain = question && !result ? pointsByTime(elapsedSeconds()) : null;

  return (
    <div className="main-wrap">
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          <header
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: "0.95rem", color: "#6b7280" }}>
                Continent: <strong>{selectedContinent}</strong>
              </div>
              <h2 style={{ margin: "6px 0 0" }}>Question {progressLabel}</h2>
            </div>

            <div style={{ textAlign: "right" }}>
              <div>
                Score: <strong>{score}</strong>
              </div>
              <div style={{ color: "#6b7280", fontSize: "0.95rem" }}>Max(base): {maxScore}</div>

              {/* timer HUD */}
              {question && !result && (
                <div style={{ marginTop: 8, fontSize: "0.95rem" }}>
                  ⏱️ <strong>{timeLeft}s</strong> · if correct now: <strong>{previewGain}</strong> pts
                </div>
              )}
            </div>
          </header>

          {/* SCROLLABLE BODY */}
          <section
            style={{
              padding: 20,
              maxHeight: "72vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            {error && <div style={{ color: "#dc2626", fontWeight: 600, marginBottom: 10 }}>{error}</div>}

            {!question ? (
              <div>{loading ? "Loading…" : "No question available."}</div>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>{question.prompt}</h3>

                {question.type === "mcq" && (
                  <div style={{ marginTop: 8, color: "#6b7280", fontSize: "0.95rem" }}>
                    {question.meta?.category ? (
                      <>
                        Category: <strong>{question.meta.category}</strong> ·{" "}
                      </>
                    ) : null}
                    {question.meta?.difficulty != null ? (
                      <>
                        Difficulty: <strong>{question.meta.difficulty}</strong>
                      </>
                    ) : null}
                  </div>
                )}

                <form onSubmit={submitAnswer} style={{ marginTop: 14 }}>
                  {question.type === "mcq" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      {(question.data?.choices || []).map((c, idx) => (
                        <label
                          key={idx}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            padding: "10px 12px",
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            background: "#fafafa",
                            cursor: loading || result ? "not-allowed" : "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="mcq"
                            value={idx}
                            disabled={loading || Boolean(result)}
                            checked={String(answer) === String(idx)}
                            onChange={(e) => {
                              setAnswer(e.target.value);
                              setError("");
                            }}
                            style={{ marginTop: 2 }}
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                    </div>
                  )}

                {question.type === "map" && (
                  <>
                    <div style={{ marginTop: 10, color: "#6b7280" }}>
                      Klikni državo: <strong>{question.target?.name}</strong>.
                        {mapSelection ? (
                          <>
                            {" "}
                            Izbrano: <strong>{featureName(mapSelection)}</strong>
                          </>
                        ) : null}
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                          height: 420,
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          overflow: "hidden",
                        }}
                      >
                        <QuizMap
                          ref={mapRef}
                          zoom={3}
                          countriesData={countriesGeo}
                          onCountryClick={onCountryClick}
                          selectedCountry={mapSelection}
                        />
                      </div>
                    </>
                  )}

                  {question.type === "build" && (
                    <>
                      <div style={{ marginTop: 10, color: "#6b7280" }}>
                        Izbrana elektrarna: <strong>{question.meta?.powerplant?.name}</strong> ({question.meta?.powerplant?.type})
                      </div>
                      <div style={{ marginTop: 8 }}>
                        Hladilne potrebe: <strong>{question.meta?.powerplant?.coolingNeeds}</strong> · Kapaciteta:{" "}
                        <strong>{question.meta?.powerplant?.capacityMW} MW</strong>
                      </div>
                      <div style={{ marginTop: 8, color: "#6b7280", fontSize: "0.95rem" }}>
                        Omejitve:{" "}
                        <strong>
                          {Array.isArray(question.meta?.powerplant?.constraints) && question.meta.powerplant.constraints.length
                            ? question.meta.powerplant.constraints.join(", ")
                            : "none"}
                        </strong>
                      </div>
                      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
                        <img
                          src={question.data?.placeholderImg}
                          alt="Powerplant placeholder"
                          style={{ width: 64, height: 64 }}
                        />
                        <div style={{ color: "#6b7280", fontSize: "0.95rem" }}>
                          Odpri Elektro in sestavi krog, ki ustreza tej elektrarni. Nato se vrni in klikni Submit.
                        </div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = "/elektro";
                          }}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            background: "#f9fafb",
                            cursor: "pointer",
                          }}
                        >
                          Open Workspace
                        </button>
                      </div>
                    </>
                  )}

                  {/* keep submit/exit visible */}
                  <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        Boolean(result) ||
                        (question.type === "mcq" ? answer === "" : question.type === "map" ? !mapSelection : false)
                      }
                      style={{
                        padding: "10px 16px",
                        borderRadius: 10,
                        border: "none",
                        background: "#2563eb",
                        color: "white",
                        cursor: loading || result ? "not-allowed" : "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {loading ? "Checking…" : "Submit"}
                    </button>

                    <button
                      type="button"
                      onClick={resetAll}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        cursor: "pointer",
                      }}
                    >
                      Exit
                    </button>

                    {question.type === "map" && (
                      <button
                        type="button"
                        onClick={() => mapRef.current?.recenter?.()}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                          cursor: "pointer",
                        }}
                      >
                        Recenter
                      </button>
                    )}
                  </div>
                </form>

                {/* STICKY RESULT FOOTER (so "Next" is always clickable) */}
                {result && (
                  <div
                    style={{
                      position: "sticky",
                      bottom: 0,
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 12,
                      background: result.correct ? "#ecfdf5" : "#fee2e2",
                      color: result.correct ? "#065f46" : "#991b1b",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                      {result.correct ? "✅ Correct" : "❌ Incorrect"}
                    </div>

                    <div style={{ marginTop: 6, fontSize: "0.95rem" }}>
                      ⏱️ Time: <strong>{result.info?.elapsedSec}s</strong>
                      {result.correct ? (
                        <>
                          {" "}
                          · Points gained: <strong>{result.info?.gained}</strong>
                        </>
                      ) : null}
                    </div>

                    {question.type === "map" && (
                      <div style={{ marginTop: 6 }}>
                        Izbral si <strong>{result.info?.selected}</strong>. Pravilno: <strong>{result.info?.target}</strong>.
                        {result.info?.explanation ? (
                          <div style={{ marginTop: 8, color: "#111827" }}>
                            <strong>Info:</strong> {result.info.explanation}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {question.type === "mcq" && (
                      <div style={{ marginTop: 6 }}>
                        {!result.correct ? (
                          <>
                            Correct answer: <strong>{result.info?.correctLabel}</strong>
                          </>
                        ) : (
                          <>Good.</>
                        )}
                        {result.info?.explanation ? (
                          <div style={{ marginTop: 8, color: "#111827" }}>
                            <strong>Explanation:</strong> {result.info.explanation}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {question.type === "build" && (
                      <div style={{ marginTop: 6 }}>
                        {result.correct ? (
                          <>
                            Omrežje je pravilno sestavljeno.
                            {!result.info?.capacityMatch || !result.info?.insideMatch ? (
                              <div style={{ marginTop: 6 }}>
                                ⚠️ Za polne točke mora biti število mest pravilno in notranja proizvodnja enaka kapaciteti.
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            Manjkajo:{" "}
                            <strong>
                              {Array.isArray(result.info?.missing) && result.info.missing.length
                                ? result.info.missing.join(", ")
                                : "neznano"}
                            </strong>
                          </>
                        )}
                        {result.info?.cityInfo ? (
                          <div style={{ marginTop: 6 }}>
                            Povezana mesta: <strong>{result.info.cityInfo.connectedCities}</strong> · potrebna:{" "}
                            <strong>{result.info.cityInfo.requiredCities}</strong>
                          </div>
                        ) : null}
                        {result.info?.insideResult ? (
                          <div style={{ marginTop: 6 }}>
                            Notranja proizvodnja: <strong>{result.info.insideResult.outputMW} MW</strong> · stabilnost:{" "}
                            <strong>{result.info.insideResult.stable ? "da" : "ne"}</strong>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <button
                      onClick={next}
                      style={{
                        marginTop: 12,
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "none",
                        background: "#111827",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {questionNumber >= TOTAL_QUESTIONS ? "Finish run" : "Next"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {showEndGame && (
          <EndGamePopUp
            score={Math.round(score)}
            totalQuestions={TOTAL_QUESTIONS}
            maxScore={maxScore}
            onRestart={() => {
              setShowEndGame(false);
              setScore(0);
              setQuestionNumber(0);
              setQuestion(null);
              setAnswer("");
              setResult(null);
              setLoading(false);
              setError("");
              setMapSelection(null);
              setUsedUniIds([]);
              setBridgeQ4(null);
              setBridgeQ5(null);
              setQuestionStartedAt(null);
              setTimeLeft(QUESTION_TIME_LIMIT_SEC);
              setGameState("setup");
              setSelectedContinent(null);
            }}
            onExit={() => {
              setShowEndGame(false);
              resetAll();
            }}
          />
        )}
      </div>
    </div>
  );
}
