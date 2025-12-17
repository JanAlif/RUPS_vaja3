
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import sloBorder from '../assets/sloBorder.json';
import pinIconPng from '../assets/pin.png';


const customIcon = L.icon({
  iconUrl: pinIconPng,  
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});



const MapControls = forwardRef(({ center, zoom }, ref) => {
  const map = useMap();
  useImperativeHandle(ref, () => ({
    recenter: () => map.flyTo([center.lat, center.lng], zoom, { duration: 0.6 }),
    locate: () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          map.flyTo([latitude, longitude], Math.max(12, zoom), { duration: 0.6 });
          L.marker([latitude, longitude]).addTo(map).bindPopup('').openPopup();
        },
        (err) => console.warn('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    },
    getMap: () => map,
  }));
  return null;
});

function MapClickHandler({ onMarkerPlaced, sloBorder }) {
  const map = useMap();



  useEffect(() => {
    const handleClickOnce = (e) => {
      const { lat, lng } = e.latlng;
      
      onMarkerPlaced?.({ lat, lng });
    };
    map.once('click', handleClickOnce);
    return () => map.off('click', handleClickOnce);
  }, [map, onMarkerPlaced]);

  return null;
}

const SloMapLeaflet = forwardRef(({ center = { lat: 46.0569, lng: 14.5058 }, zoom = 7, markerPosition, onMarkerPlaced }, ref) => {
  const [marker, setMarker] = useState(markerPosition);

  useEffect(() => {
    setMarker(markerPosition);
  }, [markerPosition]);

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} style={{ height: '100%', width: '100%' }}>
      <MapControls ref={ref} center={center} zoom={zoom} />


      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">Carto</a> © OpenStreetMap contributors'
      />
    {/* dark mode 
    <TileLayer
    url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
    attribution='&copy; <a href="https://carto.com/">Carto</a> © OpenStreetMap contributors'
    />
    */}



      <GeoJSON
        data={sloBorder}
        style={{ color: '#2563eb', weight: 2, fillOpacity: 0.1 }}
      />

      <MapClickHandler sloBorder={sloBorder} onMarkerPlaced={(pos) => {
        setMarker(pos);        
        onMarkerPlaced?.(pos);
      }} />

      {marker && (
        <Marker position={[marker.lat, marker.lng]} icon={customIcon}>
          <Popup>
            📍 {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
});

export default SloMapLeaflet;
