import { useRef, useState, useEffect, useCallback } from "react";
import L from "leaflet";
import SloMapLeaflet from "../components/SloMapLeaflet";
import { useAuth } from "../context/AuthContext";
import sloBorder from "../assets/sloBorder.json";
import pinIconPng from "../assets/pin.png";
import correctIconPng from "../assets/greenpin.png";
import EndGameModal from "../components/EndGamePopUp";
import { useNavigate } from "react-router-dom";


export default function Quiz() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [clickedCoords, setClickedCoords] = useState(null);
  const [targetCity, setTargetCity] = useState("");
  const [correctCoords, setCorrectCoords] = useState(null);
  const [round, setRound] = useState(1);
  const [correctMarkerInstance, setCorrectMarkerInstance] = useState(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const { user } = useAuth();

  const MAX_ROUNDS = 5;
  const maxScore = MAX_ROUNDS * 10;
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5050";

  const customIcon = L.icon({
    iconUrl: pinIconPng,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
  
  
  useEffect(() => {
    fetch(`${apiBase}api/leaderboard/slo-highscore`, {
      method: "GET",
      credentials: "include", 
    })
      .then(res => res.json())
      .then(data => setHighScore(data.slo_points))
      .catch(err => console.error(err));

  }, [apiBase]);

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const fetchRandomCity = useCallback(() => {
    fetch(`${apiBase}api/cities/random`)
      .then((res) => res.json())
      .then((data) => {
        if (data.city) {
          setTargetCity(data.city);
          setClickedCoords(null);
          setCorrectCoords(null);
          setFeedback("");
        }
      })
      .catch((err) => console.error("Error fetching city:", err));
  }, [apiBase]);

  useEffect(() => {
    const next_round_button = document.getElementById("next_round");
    if (next_round_button) {
      next_round_button.disabled = true;
    }
    fetchRandomCity();
  }, [fetchRandomCity]);

  function handleMarkerPlaced(latlng) {
    setClickedCoords([latlng.lat, latlng.lng]);
  }

  function calculateScore(distanceKm) {
    if (distanceKm <= 3) return 10;
    if (distanceKm <= 5) return 9;
    if (distanceKm <= 10) return 8;
    if (distanceKm <= 15) return 7;
    if (distanceKm <= 20) return 6;
    if (distanceKm <= 25) return 5;
    if (distanceKm <= 30) return 4;
    if (distanceKm <= 40) return 2;
    if (distanceKm <= 50) return 1;
    return 0;
  }

  function handleSubmit() {
    if (!targetCity || !mapRef.current || !clickedCoords) return;

    fetch(`${apiBase}api/cities/coords?name=${encodeURIComponent(targetCity)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.lat && data.lng) {
          setCorrectCoords([data.lat, data.lng]);
          const map = mapRef.current.getMap();

          if (correctMarkerInstance) map.removeLayer(correctMarkerInstance);

          const newMarker = L.marker([data.lat, data.lng], {
            icon: L.icon({
              iconUrl: correctIconPng,
              iconSize: [32, 32],
              iconAnchor: [16, 32],
              popupAnchor: [0, -32],
            }),
          }).addTo(map);

          newMarker.bindPopup(`${targetCity}`).openPopup();
          setCorrectMarkerInstance(newMarker);

          const distanceKm = calculateDistance(
            clickedCoords[0],
            clickedCoords[1],
            data.lat,
            data.lng
          );

          setFeedback(`Distance from correct location: ${distanceKm.toFixed(2)} km`);

          const points = calculateScore(distanceKm);
          setScore((s) => s + points);
        }
      })
      .catch((err) => console.error("Error fetching coordinates:", err));

    const next_round_button = document.getElementById("next_round");
    if (next_round_button) next_round_button.disabled = false;

    const submit_round_button = document.getElementById("submit_round");
    if (submit_round_button) submit_round_button.disabled = true;
  }

  function saveHighScore(finalScore) {
    fetch(`${apiBase}api/leaderboard/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        userId: user._id, 
        username: user.username, 
        gameType: "slovenian-cities", 
        score: finalScore, 
        maxScore: maxScore, 
        percentage: ((finalScore / maxScore) * 100).toFixed(0)}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.updated) {
          console.log("🎉 New high score saved!");
          setHighScore(data.slo_points);
        } else {
          console.log("No new high score.");
        }
      })
      .catch((err) => console.error("Error updating high score:", err));
  }

  function handleNextRound() {
    if (round >= MAX_ROUNDS) {
      saveHighScore(score); 
      setShowEndModal(true);
    } else {
      setRound((r) => r + 1);
    }

    if (mapRef.current && correctMarkerInstance) {
      const map = mapRef.current.getMap();
      map.removeLayer(correctMarkerInstance);
      setCorrectMarkerInstance(null);
    }

    fetchRandomCity();

    const next_round_button = document.getElementById("next_round");
    if (next_round_button) next_round_button.disabled = true;

    const submit_round_button = document.getElementById("submit_round");
    if (submit_round_button) submit_round_button.disabled = false;
  }

  return (
    <div className="main-wrap">
      <div className="map-card">
        <div
          className="map-toolbar"
          style={{
            borderBottom: "1px solid #eef0f3",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="toolbar-title">
              Round {round} / {MAX_ROUNDS}
            </span>
            <span style={{ fontWeight: 700 }}>
              Find this city: {targetCity || "Loading..."}
              {clickedCoords && (
                <span
                  style={{
                    marginLeft: 10,
                    fontWeight: 400,
                    fontSize: "0.9em",
                    color: "#555",
                  }}
                >
                  📍 {clickedCoords[0].toFixed(4)}, {clickedCoords[1].toFixed(4)}
                </span>
              )}
            </span>

            {feedback && (
              <span
                style={{
                  marginTop: 2,
                  display: "block",
                  fontWeight: 400,
                  fontSize: "0.9em",
                  color: "#f39c12",
                }}
              >
                {feedback}
              </span>
            )}
          </div>
          <div className="toolbar-spacer" />
          <div>
            Score: <strong>{score}</strong> | 🏆 High Score:{" "}
            <strong>{highScore}</strong> {/* ✅ show live high score */}
          </div>
          <button className="tool" onClick={() => mapRef.current?.recenter()}>
            Recenter
          </button>
          <button id="submit_round" className="tool" onClick={handleSubmit}>
            Submit
          </button>
          <button id="next_round" className="tool" onClick={handleNextRound}>
            {round >= MAX_ROUNDS ? "Finish Game" : "Next Round"}
          </button>
        </div>

        {/* Map */}
        <div className="map-viewport" style={{ height: "500px" }}>
          <SloMapLeaflet
            ref={mapRef}
            zoom={7}
            countriesData={sloBorder}
            markerIcon={customIcon}
            onMarkerPlaced={handleMarkerPlaced}
          />
        </div>
      </div>

      
      {showEndModal && (
        <EndGameModal
          score={score}
          highScore={highScore}
          rounds={MAX_ROUNDS}
          onRestart={() => {
            setShowEndModal(false);
            setScore(0);
            setRound(1);
            setClickedCoords(null);
            setCorrectCoords(null);
            setTargetCity("");
            fetchRandomCity();
          }}
          onExit={() => navigate("/")}
          maxScore={maxScore}
        />
      )}
    </div>
  );
}
