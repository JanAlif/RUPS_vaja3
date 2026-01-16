import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
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

// Filter Menu component using Leaflet Control
function FilterMenu({ onFilterChange, powerRange, visibleCount, totalCount, currentFilters }) {
  const map = useMap();
  const controlRef = useRef(null);
  const countDisplayRef = useRef(null);
  const containerRef = useRef(null);
  
  // Create control only once
  useEffect(() => {
    const FilterControl = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create('div', 'powerplant-filter');
        div.style.pointerEvents = 'auto';
        containerRef.current = div;
        
        // Create filter UI with initial state
        const filterHTML = `
          <div style="
            background-color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-size: 13px;
            min-width: 220px;
            max-width: 280px;
            font-family: system-ui, -apple-system, sans-serif;
            max-height: 80vh;
            overflow-y: auto;
          ">
            <div style="
              font-weight: 600;
              margin-bottom: 12px;
              font-size: 15px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <span>Filters</span>
              <button id="clear-filters" style="
                background: #ef4444;
                color: white;
                border: none;
                padding: 4px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 500;
              ">Clear</button>
            </div>
            <div id="count-display" style="
              margin-bottom: 12px;
              padding: 8px;
              background-color: #f3f4f6;
              border-radius: 4px;
              font-size: 12px;
              color: #374151;
              text-align: center;
            ">
              Showing <strong>${visibleCount}</strong> of <strong>${totalCount}</strong> powerplants
            </div>
            
            <div style="margin-bottom: 16px;">
              <div style="
                font-weight: 600;
                margin-bottom: 8px;
                font-size: 13px;
                color: #374151;
              ">Type</div>
              ${Object.entries(typeColors).map(([type, color]) => `
                <label style="
                  display: flex;
                  align-items: center;
                  margin-bottom: 6px;
                  cursor: pointer;
                  padding: 4px 0;
                ">
                  <input 
                    type="checkbox" 
                    class="type-filter" 
                    value="${type}" 
                    ${currentFilters.types.includes(type) ? 'checked' : ''}
                    style="
                      margin-right: 8px;
                      cursor: pointer;
                      width: 16px;
                      height: 16px;
                    "
                  />
                  <div style="
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background-color: ${color};
                    border: 2px solid white;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                    margin-right: 8px;
                    flex-shrink: 0;
                  "></div>
                  <span style="color: #374151; font-size: 12px;">${getTypeLabel(type)}</span>
                </label>
              `).join('')}
            </div>
            
            <div>
              <div style="
                font-weight: 600;
                margin-bottom: 8px;
                font-size: 13px;
                color: #374151;
              ">Power Capacity (MW)</div>
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                <input 
                  type="number" 
                  id="min-power" 
                  placeholder="Min" 
                  min="0"
                  value="${currentFilters.minPower !== null ? currentFilters.minPower : ''}"
                  style="
                    width: 80px;
                    padding: 6px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                  "
                />
                <span style="color: #6b7280;">-</span>
                <input 
                  type="number" 
                  id="max-power" 
                  placeholder="Max" 
                  min="0"
                  value="${currentFilters.maxPower !== null ? currentFilters.maxPower : ''}"
                  style="
                    width: 80px;
                    padding: 6px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                  "
                />
              </div>
              <div style="
                font-size: 11px;
                color: #6b7280;
                margin-top: 4px;
              ">Range: ${powerRange.min} - ${powerRange.max} MW</div>
            </div>
          </div>
        `;
        
        div.innerHTML = filterHTML;
        countDisplayRef.current = div.querySelector('#count-display');
        
        // Add event listeners
        const typeCheckboxes = div.querySelectorAll('.type-filter');
        const minPowerInput = div.querySelector('#min-power');
        const maxPowerInput = div.querySelector('#max-power');
        const clearButton = div.querySelector('#clear-filters');
        
        const updateFilters = () => {
          // Re-query checkboxes to get current state (in case DOM was updated)
          const currentCheckboxes = div.querySelectorAll('.type-filter');
          const selectedTypes = Array.from(currentCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
          
          const minPower = minPowerInput.value ? parseFloat(minPowerInput.value) : null;
          const maxPower = maxPowerInput.value ? parseFloat(maxPowerInput.value) : null;
          
          onFilterChange({
            types: selectedTypes,
            minPower,
            maxPower
          });
        };
        
        typeCheckboxes.forEach(cb => {
          cb.addEventListener('change', updateFilters);
        });
        
        minPowerInput.addEventListener('input', updateFilters);
        maxPowerInput.addEventListener('input', updateFilters);
        
        clearButton.addEventListener('click', () => {
          typeCheckboxes.forEach(cb => cb.checked = true);
          minPowerInput.value = '';
          maxPowerInput.value = '';
          updateFilters();
        });
        
        return div;
      }
    });
    
    const filterControl = new FilterControl({ position: 'topleft' });
    filterControl.addTo(map);
    controlRef.current = filterControl;
    
    return () => {
      map.removeControl(filterControl);
    };
  }, [map, onFilterChange, powerRange]);
  
  // Update count display without recreating the control
  useEffect(() => {
    if (countDisplayRef.current) {
      countDisplayRef.current.innerHTML = `Showing <strong>${visibleCount}</strong> of <strong>${totalCount}</strong> powerplants`;
    }
  }, [visibleCount, totalCount]);
  
  // No sync needed - checkboxes are the source of truth
  // They control the filter state directly through event listeners
  
  return null;
}

// Legend component using Leaflet Control
function Legend() {
  const map = useMap();
  
  useEffect(() => {
    const LegendControl = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create('div', 'powerplant-legend');
        div.style.marginBottom = '10vh';
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
  const [filters, setFilters] = useState({
    types: Object.keys(typeColors), // All types selected by default
    minPower: null,
    maxPower: null
  });

  // Calculate power range from data
  const powerRange = useMemo(() => {
    if (powerplants.length === 0) return { min: 0, max: 1000 };
    
    const capacities = powerplants
      .map(p => p.mgw || p.capacityMW || 0)
      .filter(cap => cap > 0);
    
    if (capacities.length === 0) return { min: 0, max: 1000 };
    
    return {
      min: Math.floor(Math.min(...capacities)),
      max: Math.ceil(Math.max(...capacities))
    };
  }, [powerplants]);

  // Filter powerplants based on current filters
  const filteredPowerplants = useMemo(() => {
    return powerplants.filter(p => {
      // Type filter
      const type = p.type?.toLowerCase();
      if (filters.types.length > 0 && !filters.types.includes(type)) {
        return false;
      }
      
      // Power filter
      const capacity = p.mgw || p.capacityMW || 0;
      if (filters.minPower !== null && capacity < filters.minPower) {
        return false;
      }
      if (filters.maxPower !== null && capacity > filters.maxPower) {
        return false;
      }
      
      return true;
    });
  }, [powerplants, filters]);

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

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
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
        .leaflet-bottom.leaflet-right .powerplant-legend {
          margin-bottom: 10vh !important;
        }
        .powerplant-filter {
          pointer-events: auto;
        }
        .powerplant-filter input[type="checkbox"] {
          accent-color: #3b82f6;
        }
        .powerplant-filter input[type="number"]:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }
        .powerplant-filter button:hover {
          background: #dc2626 !important;
        }
        .powerplant-filter label:hover {
          background-color: #f9fafb;
          border-radius: 4px;
        }
        .powerplant-filter::-webkit-scrollbar {
          width: 6px;
        }
        .powerplant-filter::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        .powerplant-filter::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .powerplant-filter::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
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
          <FilterMenu 
            onFilterChange={handleFilterChange} 
            powerRange={powerRange}
            visibleCount={filteredPowerplants.length}
            totalCount={powerplants.length}
            currentFilters={filters}
          />
          {filteredPowerplants.map((p) => (
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
