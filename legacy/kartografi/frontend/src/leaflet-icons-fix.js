// Fix default Leaflet icon paths under Vite / bundlers
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import icon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl: icon2xUrl,
  shadowUrl,
});