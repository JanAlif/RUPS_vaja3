// src/components/QuizMap.jsx
import { useEffect, useMemo, useState, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

// Countries layer for quiz - no tooltips or labels
function CountriesLayer({ data, dataUrl, onCountryClick, selectedCountry }) {
  const [geo, setGeo] = useState(data ?? null);

  useEffect(() => {
    if (data || !dataUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(dataUrl, { cache: 'no-cache' });
        if (!res.ok) {
          console.warn(`CountriesLayer: ${dataUrl} returned HTTP ${res.status}`);
          return;
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json') && !ct.includes('geo+json')) {
          const text = await res.text();
          console.warn('CountriesLayer: response is not JSON. First bytes:', text.slice(0, 120));
          return;
        }
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
    
    // NO TOOLTIP - don't reveal country name during quiz

    // Check if this is the selected country using multiple criteria
    // Compare ISO-2, ISO-3 (excluding "-99" placeholder), and fallback to name comparison
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
        if (!isSelected) {
          e.target.setStyle(highlightStyle); 
        }
        e.target.bringToFront?.(); 
      },
      mouseout: (e) => {
        if (!isSelected) {
          e.target.setStyle(baseStyle);
        } else {
          e.target.setStyle(selectedStyle);
        }
      },
      click: (e) => {
        // Just trigger the click handler - no popup
        onCountryClick?.(feature, e);
      },
    });
  }

  if (!geo) return null;
  return <GeoJSON data={geo} style={() => baseStyle} onEachFeature={onEachFeature} key={JSON.stringify(selectedCountry)} />;
}

const QuizMap = forwardRef(function QuizMap(
  {
    center = { lat: 46.0569, lng: 14.5058 },
    zoom = 4,
    countriesData,
    countriesUrl,
    onCountryClick,
    selectedCountry,
  },
  ref
) {
  const mapCenter = useMemo(() => [center.lat, center.lng], [center]);

  function MapControlBridge() {
    const map = useMap();
    useImperativeHandle(ref, () => ({
      recenter: () => map.flyTo(mapCenter, zoom, { duration: 0.6 }),
    }), [map]);
    return null;
  }

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        {/* Use tile layer without labels */}
        <TileLayer
          attribution=""
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        />
        <CountriesLayer
          data={countriesData}
          dataUrl={countriesUrl}
          onCountryClick={onCountryClick}
          selectedCountry={selectedCountry}
        />
        <MapControlBridge />
      </MapContainer>
    </div>
  );
});

export default QuizMap;
