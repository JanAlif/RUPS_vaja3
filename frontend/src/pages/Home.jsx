import { useRef, useState } from "react";
import MapLeaflet from "../components/MapLeaflet";
import countriesGeo from "../assets/countries.json";

export default function Home() {
  const mapRef = useRef(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCountryInfo, setSelectedCountryInfo] = useState(null);

  const [expandedSections, setExpandedSections] = useState({
    background: false,
    geography: false,
    people: false,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderField = (val) => {
    if (!val) return "N/A";
    if (typeof val === "string") return <span dangerouslySetInnerHTML={{ __html: val }} />;
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object") {
      if (val.text) return <span dangerouslySetInnerHTML={{ __html: val.text }} />;
      return (
        <ul style={{ margin: "4px 0 8px 16px", padding: 0, listStyle: "disc" }}>
          {Object.entries(val).map(([key, v]) => (
            <li key={key}>
              <strong>{key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())}:</strong>{" "}
              {renderField(v)}
            </li>
          ))}
        </ul>
      );
    }
    return String(val);
  };

  const formatKey = (key) =>
    key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());

  const countryCodeToEmoji = (code) => {
    if (!code || code.length !== 2) return "🏳️";
    const OFFSET = 127397;
    return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + OFFSET)).join('');
  };

  function handleCountryClick(info) {
    setSelectedCountry(info.feature);
    setSelectedCountryInfo({
      name: info.name,
      iso2: info.iso2 || "",
      background: info.background || "N/A",
      geography: info.geography || {},
      people: info.people || null,
    });


    setExpandedSections({ background: false, geography: false, people: false });
  }

  return (
    <div className="main-wrap">
      <div className="hero">
        <h1>Explore the map</h1>
        <p>Click anywhere to drop a marker. Countries are outlined & clickable.</p>

        {selectedCountryInfo && (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
              background: "#f9fafb",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ padding: "10px 16px", fontWeight: "bold" }}>
              {countryCodeToEmoji(selectedCountryInfo.iso2)} {selectedCountryInfo.name}
            </div>

            <div style={{ padding: "10px 16px" }}>
              {/* Background */}
              <div style={{ marginBottom: 12 }}>
                <h4
                  style={{ margin: "6px 0", cursor: "pointer" }}
                  onClick={() => toggleSection("background")}
                >
                  {expandedSections.background ? "▼" : "▶"} Background
                </h4>
                {expandedSections.background && (
                  <p style={{ margin: "4px 0" }}>{renderField(selectedCountryInfo.background)}</p>
                )}
              </div>

              {/* Geography */}
              {selectedCountryInfo.geography && Object.keys(selectedCountryInfo.geography).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h4
                    style={{ margin: "6px 0", cursor: "pointer" }}
                    onClick={() => toggleSection("geography")}
                  >
                    {expandedSections.geography ? "▼" : "▶"} Geography
                  </h4>
                  {expandedSections.geography && Object.entries(selectedCountryInfo.geography).map(([key, value]) => (
                    <div key={key} style={{ marginBottom: 6 }}>
                      <strong>{formatKey(key)}:</strong> {renderField(value)}
                    </div>
                  ))}
                </div>
              )}

              {/* People & Society */}
              {selectedCountryInfo.people && (
                <div style={{ marginBottom: 12 }}>
                  <h4
                    style={{ margin: "6px 0", cursor: "pointer" }}
                    onClick={() => toggleSection("people")}
                  >
                    {expandedSections.people ? "▼" : "▶"} People & Society
                  </h4>
                  {expandedSections.people && Object.entries(selectedCountryInfo.people).map(([key, value]) => (
                    <div key={key} style={{ marginBottom: 6 }}>
                      <strong>{formatKey(key)}:</strong> {renderField(value)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="map-card">
        <div className="map-toolbar">
          <span className="toolbar-title">Ljubljana</span>
          <input className="search" placeholder="Search places (UI only)" />
          <div className="toolbar-spacer" />
          <button className="tool" onClick={() => mapRef.current?.recenter()}>Recenter</button>
          <button className="tool" onClick={() => mapRef.current?.locate()}>My location</button>
        </div>

        <div style={{ height: "75vh" }}>
          <MapLeaflet
            ref={mapRef}
            zoom={4}
            fetchFromBackend={false}
            countriesData={countriesGeo}
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountry}
          />
        </div>
      </div>
    </div>
  );
}
