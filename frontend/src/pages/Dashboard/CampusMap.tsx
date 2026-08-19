import { useState, useEffect, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../../context/AuthContext';

export default function CampusMap() {
  const mapRef = useRef(null);
  const { user } = useAuth();

  const [viewState, setViewState] = useState({
    longitude: 14.7900,
    latitude: 40.7700,
    zoom: 15,
    pitch: 45,
    bearing: 0
  });

  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>('');

  // 1. Geolocalizzazione Utente
  useEffect(() => {
    if (user?.role === 'UTENTE' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setViewState(prev => ({
          ...prev,
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        }));
      });
    }
  }, [user]);

  // 2. Fetch Campus per Operatore/Amministratore
  useEffect(() => {
    if (user && (user.role === 'OPERATORE' || user.role === 'AMMINISTRATORE')) {
      const fetchCampuses = async () => {
        const mockCampuses = [
          {
            id: 'c0000000-0000-0000-0000-000000000001',
            name: 'Campus di Fisciano',
            geojson: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[[14.787, 40.775], [14.798, 40.775], [14.798, 40.768], [14.787, 40.768], [14.787, 40.775]]]
              }
            }
          }
        ];

        setCampuses(mockCampuses);
        if (mockCampuses.length > 0) {
          setSelectedCampus(mockCampuses[0].id);
        }
      };
      fetchCampuses();
    }
  }, [user]);

  const activeCampusData = campuses.find(c => c.id === selectedCampus)?.geojson;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] w-full">
      <div className="flex flex-row items-center justify-between mb-4">
        <h2 className="font-semibold text-title-md2 text-black dark:text-white">
          Mappa del Campus
        </h2>
        
        {(user?.role === 'OPERATORE' || user?.role === 'AMMINISTRATORE') && campuses.length > 0 && (
          <select 
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="px-4 py-2 bg-white border rounded-lg shadow-sm border-stroke text-black dark:bg-boxdark dark:border-strokedark dark:text-white"
          >
            {campuses.map(campus => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="relative flex-1 w-full overflow-hidden border rounded-xl border-stroke shadow-default dark:border-strokedark dark:bg-boxdark">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          interactive={true}
          dragPan={true}
          scrollZoom={true}
          // AGGIUNGI QUESTO: Dice a MapLibre di usare un transform generico ed evita i conflitti col worker esterno su Vite
          transformRequest={(url) => {
            return { url };
          }}
        >
          {activeCampusData && (
            <Source id="campus-boundary" type="geojson" data={activeCampusData}>
              <Layer 
                id="campus-fill" 
                type="fill" 
                paint={{
                  'fill-color': '#3C50E0', 
                  'fill-opacity': 0.2
                }} 
              />
              <Layer 
                id="campus-outline" 
                type="line" 
                paint={{
                  'line-color': '#3C50E0',
                  'line-width': 2
                }} 
              />
            </Source>
          )}
        </Map>
      </div>
    </div>
  );
}