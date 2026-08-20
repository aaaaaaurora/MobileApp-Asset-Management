import { useState, useEffect, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../../context/AuthContext';

export default function CampusMap() {
  const mapRef = useRef(null);
  const { user, token } = useAuth();

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
          try {
            // Utilizziamo l'URL del Gateway basandoci sulle variabili d'ambiente
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/geozones/campuses`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Passiamo il JWT al Gateway
              }
            });

            if (!response.ok) {
              throw new Error(`Errore HTTP: ${response.status}`);
            }

            const realCampuses = await response.json();
            setCampuses(realCampuses);
            
            if (realCampuses.length > 0) {
              setSelectedCampus(realCampuses[0].id);
            }
          } catch (error) {
            console.error("Errore nel recupero dei poligoni dal GeoZone Service tramite Gateway:", error);
          }
        };
        
        fetchCampuses();
      }
    }, [user]);

    // Estraiamo il campus selezionato e lo convertiamo in una valid Feature GeoJSON per MapLibre
    const activeCampus = campuses.find(c => c.id === selectedCampus);
    
    const activeCampusData = activeCampus?.geometry ? {
      type: 'Feature',
      geometry: activeCampus.geometry,
      properties: {
        name: activeCampus.name,
        description: activeCampus.description
      }
    } : null;

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