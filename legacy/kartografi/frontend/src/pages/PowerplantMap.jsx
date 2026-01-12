import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// import axios from "axios";
import L from "leaflet";

// Color mapping for powerplant types
const typeColors = {
  hydro: "blue",
  solar: "yellow",
  wind: "green",
  nuclear: "red",
  coal: "black",
  gas: "orange"
};

function getColor(type) {
  if (!type) return "gray";
  const key = type.toLowerCase();
  return typeColors[key] || "gray";
}

function getMarkerIcon(color) {
  // Simple colored marker using Leaflet's default icon
  return L.divIcon({
    className: "custom-marker",
    html: `<svg width='24' height='24'><circle cx='12' cy='12' r='10' fill='${color}' stroke='white' stroke-width='2'/></svg>`
  });
}

const PowerplantMap = () => {
  const [powerplants, setPowerplants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/powerplants")
      .then(res => res.json())
      .then(data => {
        setPowerplants(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer center={[46.1512, 14.9955]} zoom={8} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {powerplants.map((p) => (
          <Marker
            key={p._id}
            position={[p.latitude, p.longitude]}
            icon={getMarkerIcon(getColor(p.type))}
          >
            <Popup>
              <strong>{p.name}</strong><br />
              Type: {p.type}<br />
              Capacity: {p.mgw || p.capacityMW} MW<br />
              Cooling Needed: {p.coolingNeeds || "N/A"}<br />
              Active: {p.isActive ? "Yes" : "No"}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default PowerplantMap;
