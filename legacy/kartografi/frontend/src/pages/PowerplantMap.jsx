import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// import axios from "axios";
import L from "leaflet";

// Color mapping for powerplant types
const typeColors = {
  hydro: "#3b82f6",      // blue
  solar: "#fbbf24",      // yellow/amber
  wind: "#10b981",       // green
  nuclear: "#ef4444",    // red
  coal: "#1f2937",       // dark gray/black
  gas: "#f97316"         // orange
};

const typeLabels = {
  hydro: "Hydroelectric",
  solar: "Solar",
  wind: "Wind",
  nuclear: "Nuclear",
  coal: "Coal",
  gas: "Gas"
};

function getColor(type) {
  if (!type) return "#6b7280"; // gray
  const key = type.toLowerCase();
  return typeColors[key] || "#6b7280";
}

function getTypeLabel(type) {
  if (!type) return "Unknown";
  const key = type.toLowerCase();
  return typeLabels[key] || type;
}

// Create marker icon that scales with zoom level
function createMarkerIcon(color, zoom) {
  // Scale marker size based on zoom level
  // At zoom 6: size 12px, at zoom 10: size 20px, at zoom 14+: size 28px
  const baseSize = Math.max(12, Math.min(28, 8 + (zoom - 6) * 2));
  const radius = baseSize * 0.4;
  const strokeWidth = Math.max(1.5, baseSize / 12);
  
  // Create a nicer pin-style marker with shadow
  const svg = `
    <svg width="${baseSize * 1.5}" height="${baseSize * 1.5}" viewBox="0 0 ${baseSize * 1.5} ${baseSize * 1.5}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="1" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle 
        cx="${baseSize * 0.75}" 
        cy="${baseSize * 0.75}" 
        r="${radius}" 
        fill="${color}" 
        stroke="white" 
        stroke-width="${strokeWidth}"
        filter="url(#shadow)"
        style="transition: all 0.2s ease;"
      />
      <circle 
        cx="${baseSize * 0.75}" 
        cy="${baseSize * 0.75}" 
        r="${radius * 0.4}" 
        fill="white" 
        opacity="0.6"
      />
    </svg>
  `;
  
  return L.divIcon({
    className: "custom-powerplant-marker",
    html: svg,
    iconSize: [baseSize * 1.5, baseSize * 1.5],
    iconAnchor: [baseSize * 0.75, baseSize * 0.75],
    popupAnchor: [0, -baseSize * 0.75]
  });
}

// Component to provide zoom level to markers
function ZoomProvider({ children, onZoomChange }) {
  const map = useMap();
  
  useEffect(() => {
    const updateZoom = () => {
      onZoomChange(map.getZoom());
    };
    
    updateZoom(); // Initial zoom
    map.on('zoomend', updateZoom);
    map.on('zoom', updateZoom);
    
    return () => {
      map.off('zoomend', updateZoom);
      map.off('zoom', updateZoom);
    };
  }, [map, onZoomChange]);
  
  return null;
}

// Component for individual marker
function PowerplantMarker({ powerplant, color, zoom }) {
  const icon = useMemo(() => createMarkerIcon(color, zoom), [color, zoom]);
  
  return (
    <Marker
      position={[powerplant.latitude, powerplant.longitude]}
      icon={icon}
    >
      <Popup>
        <div style={{ minWidth: '150px' }}>
          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '6px' }}>
            {powerplant.name}
          </strong>
          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            <div><strong>Type:</strong> {getTypeLabel(powerplant.type)}</div>
            <div><strong>Capacity:</strong> {powerplant.mgw || powerplant.capacityMW || 'N/A'} MW</div>
            {powerplant.coolingNeeds && (
              <div><strong>Cooling:</strong> {powerplant.coolingNeeds}</div>
            )}
            <div><strong>Status:</strong> {powerplant.isActive ? '🟢 Active' : '🔴 Inactive'}</div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// Legend component using Leaflet Control
function Legend() {
  const map = useMap();
  
  useEffect(() => {
    const LegendControl = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create('div', 'powerplant-legend');
        div.innerHTML = `
          <div style="
            background-color: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-size: 13px;
            min-width: 180px;
            font-family: system-ui, -apple-system, sans-serif;
          ">
            <div style="
              font-weight: 600;
              margin-bottom: 10px;
              font-size: 14px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 8px;
            ">
              Powerplant Types
            </div>
            ${Object.entries(typeColors).map(([type, color]) => `
              <div style="
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                cursor: default;
              ">
                <div style="
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background-color: ${color};
                  border: 2px solid white;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                  margin-right: 10px;
                  flex-shrink: 0;
                "></div>
                <span style="color: #374151;">${getTypeLabel(type)}</span>
              </div>
            `).join('')}
          </div>
        `;
        return div;
      }
    });
    
    const legend = new LegendControl({ position: 'bottomright' });
    legend.addTo(map);
    
    return () => {
      map.removeControl(legend);
    };
  }, [map]);
  
  return null;
}

const PowerplantMap = () => {
  const [powerplants, setPowerplants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(8);

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

  if (loading) {
    return (
      <div style={{ 
        height: "100vh", 
        width: "100%", 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center",
        fontSize: "18px",
        color: "#6b7280"
      }}>
        Loading powerplants...
      </div>
    );
  }

  return (
    <>
      <style>{`
        .custom-powerplant-marker {
          background: transparent !important;
          border: none !important;
        }
        .custom-powerplant-marker svg {
          transition: transform 0.2s ease;
        }
        .custom-powerplant-marker:hover svg {
          transform: scale(1.2);
        }
        .powerplant-legend {
          pointer-events: auto;
        }
        .powerplant-legend * {
          pointer-events: none;
        }
      `}</style>
      <div style={{ height: "100vh", width: "100%", position: "relative" }}>
        <MapContainer 
          center={[46.1512, 14.9955]} 
          zoom={8} 
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <ZoomProvider onZoomChange={setZoom} />
          {powerplants.map((p) => (
            <PowerplantMarker
              key={p._id}
              powerplant={p}
              color={getColor(p.type)}
              zoom={zoom}
            />
          ))}
          <Legend />
        </MapContainer>
      </div>
    </>
  );
};

export default PowerplantMap;
