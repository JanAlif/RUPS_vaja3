import { useEffect, useMemo, useState, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';


function ClickToAddMarker() {
  return null;
}

function CountriesLayer({ data, dataUrl, onCountryClick, selectedCountry }) {
  const [geo, setGeo] = useState(data ?? null);

  useEffect(() => {
    if (data || !dataUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(dataUrl, { cache: 'no-cache' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setGeo(json);
      } catch (e) {
        console.warn('CountriesLayer: failed to load', e);
      }
    })();
    return () => { cancelled = true; };
  }, [data, dataUrl]);

  const baseStyle = { weight: 1, color: '#1f2937', opacity: 0.9, fillColor: '#60a5fa', fillOpacity: 0.15 };
  const highlightStyle = { weight: 2, color: '#2563eb', fillOpacity: 0.25 };
  const selectedStyle = { weight: 3, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.4 };

  function onEachFeature(feature, layer) {
    const name = feature?.properties?.name || feature?.properties?.ADMIN || 'Unknown country';
    const iso = (feature?.properties?.ISO_A2 || feature?.properties?.iso_a2 || '').toUpperCase().trim();
    const iso3 = (feature?.properties?.ISO_A3 || feature?.properties?.iso_a3 || '').toUpperCase().trim();
    const selectedIso = (selectedCountry?.properties?.ISO_A2 || selectedCountry?.properties?.iso_a2 || '').toUpperCase().trim();
    const selectedIso3 = (selectedCountry?.properties?.ISO_A3 || selectedCountry?.properties?.iso_a3 || '').toUpperCase().trim();
    const selectedName = (selectedCountry?.properties?.name || selectedCountry?.properties?.ADMIN || '').trim();
    
    layer.bindTooltip(name, { sticky: true });

    const isSelected = selectedCountry && (
      (iso && selectedIso && iso.length === 2 && iso !== '-99' && iso === selectedIso) ||
      (iso3 && selectedIso3 && iso3.length === 3 && iso3 !== '-99' && iso3 === selectedIso3) ||
      (name && selectedName && name === selectedName)
    );

    if (isSelected) {
      layer.setStyle(selectedStyle);
    }

    layer.on({
      mouseover: (e) => { 
        if (!isSelected) e.target.setStyle(highlightStyle); 
        e.target.bringToFront?.(); 
      },
      mouseout: (e) => {
        if (!isSelected) e.target.setStyle(baseStyle);
        else e.target.setStyle(selectedStyle);
      },
      click: (e) => {
        onCountryClick?.(feature);
      },
    });
  }

  if (!geo) return null;
  return <GeoJSON data={geo} style={() => baseStyle} onEachFeature={onEachFeature} key={JSON.stringify(selectedCountry)} />;
}

const MapLeaflet = forwardRef(function MapLeaflet(
  {
    center = { lat: 46.0569, lng: 14.5058 },
    zoom = 4,
    initialMarkers = [],
    fetchFromBackend = false,
    countriesData,
    countriesUrl,
    onCountryClick,
    selectedCountry,
  },
  ref
) {
  const [markers, setMarkers] = useState(initialMarkers);
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5050";

  useEffect(() => {
    if (!fetchFromBackend || !apiBase) return;
    (async () => {
      try {
        const res = await fetch(`${apiBase}api/places`, { cache: 'no-cache' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length) setMarkers(data);
      } catch (e) {
        console.warn('Failed to fetch markers:', e);
      }
    })();
  }, [apiBase, fetchFromBackend]);

  const mapCenter = useMemo(() => [center.lat, center.lng], [center]);

  function MapControlBridge() {
    const map = useMap();
    useImperativeHandle(ref, () => ({
      recenter: () => map.flyTo(mapCenter, zoom, { duration: 0.6 }),
      locate: () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            map.flyTo([latitude, longitude], Math.max(12, zoom), { duration: 0.6 });
            L.marker([latitude, longitude]).addTo(map).bindPopup('You are here').openPopup();
          },
          (err) => console.warn('Geolocation error:', err),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      },
    }), [map]);
    return null;
  }

 
  async function handleCountryClick(feature) {
  const gec = feature?.properties?.FIPS_10 || feature?.properties?.FIPS || feature?.properties?.fips || '';
  const region = getRegionFromFeature(feature);
  let factbookData = null;

  try {
    if (gec && region) {
      const url = `https://raw.githubusercontent.com/factbook/factbook.json/master/${region}/${gec.toLowerCase()}.json`;
      const res = await fetch(url);
      if (res.ok) {
        factbookData = await res.json();
      } else {
        console.warn(`Factbook JSON not found for ${feature.properties.ADMIN}`);
      }
    }
  } catch (err) {
    console.warn("Factbook fetch error:", err);
  }


  const background = traverseField(factbookData?.Introduction?.Background ?? "N/A");

  const geography = factbookData?.Geography ?? {};
  const geographyFields = {
    location: traverseField(geography.Location),
    borderCountries: traverseField(geography["Land boundaries"]?.["border countries"]),
    coastline: traverseField(geography.Coastline),
    climate: traverseField(geography.Climate),
    terrain: traverseField(geography.Terrain),
    highestPoint: traverseField(geography.Elevation?.["highest point"]),
    lowestPoint: traverseField(geography.Elevation?.["lowest point"]),
    naturalResources: traverseField(geography["Natural resources"]),
    landUse: traverseField(geography["Land use"]),
    majorRivers: traverseField(geography["Major rivers (by length in km)"]),
    majorLakes: traverseField(geography["Major lakes (area sq km)"]),
    naturalDisasters: traverseField(geography["Natural hazards"]),
  };

  const people = factbookData?.["People and Society"] ?? null;
const government = factbookData?.["Government"] ?? null;
const environment = factbookData?.["Environment"] ?? null;

const peopleFields = people ? {
  population: traverseField(people.Population?.total),
  nationality: traverseField(people.Nationality),
  ethnicGroups: traverseField(people["Ethnic groups"]),
  languages: traverseField(people.Languages?.Languages),
  religions: traverseField(people.Religions),
  
  // Environment
  envIssues: traverseField(environment?.["Current issues"]),
  
  // Government
  independence: traverseField(government?.Independence),
  governmentType: traverseField(government?.["Government type"]),
  etymology: traverseField(government?.["Country name"]?.etymology),
  longName: traverseField(government?.["Country name"]?.["conventional long form"]),
  capital: traverseField(government?.Capital?.name),
  capitalEtymology: traverseField(government?.Capital?.etymology),
  president: traverseField(government?.["Executive branch"]?.["chief of state"]),
  premier: traverseField(government?.["Executive branch"]?.["head of government"]),
  electionProcess: traverseField(government?.["Executive branch"]?.["election/appointment process"]),
} : null;

  

  const iso2 = feature?.properties?.ISO_A2 || feature?.properties?.iso_a2 || "";

  onCountryClick?.({
    feature,
    name: feature.properties.ADMIN,
    iso2,
    background,
    geography: geographyFields,
    people: peopleFields,
  });
}
function traverseField(val) {
  if (!val) return "N/A";

  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") {
    if (val.text) return val.text;

    return Object.entries(val)
      .map(([k, v]) => `${k}: ${traverseField(v)}`)
      .join("; ");
  }
  return String(val);
}
  function getRegionFromFeature(feature) {
    const regionMap = {
      "Africa": "africa",
      "Asia": "asia",
      "Europe": "europe",
      "North America": "north-america",
      "South America": "south-america",
      "Oceania": "oceania",
      "Antarctica": "antarctica"
    };
    return regionMap[feature?.properties?.CONTINENT] || null;
  }

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        preferCanvas
        worldCopyJump
        attributionControl
        zoomControl
      >
        <MapControlBridge />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <CountriesLayer 
          data={countriesData} 
          dataUrl={countriesUrl} 
          onCountryClick={handleCountryClick}
          selectedCountry={selectedCountry}
        />

        {markers.map((m) => (
          <Marker key={m.id ?? `${m.lat},${m.lng}`} position={[m.lat, m.lng]} icon={new L.Icon.Default()}>
            <Popup>
              <strong>{m.name ?? 'Unnamed place'}</strong>
              {m.description ? <p style={{ margin: '6px 0 0' }}>{m.description}</p> : null}
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
                {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
});

export default MapLeaflet;
