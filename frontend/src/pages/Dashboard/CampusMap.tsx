import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import Map, { Source, Layer, MapRef, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../../context/AuthContext';
import WarningFormModal from '../../components/guest/WarningFormModal'; 

export default function CampusMap() {
  const mapRef = useRef<MapRef>(null);
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const focusAssetId = location.state?.focusAssetId;
  const focusCampusId = location.state?.focusCampusId;

  const [viewState, setViewState] = useState({ longitude: 14.7900, latitude: 40.7700, zoom: 15, pitch: 45, bearing: 0 });
  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>('');
  
  // Aggiunto stato per le categorie
  const [categories, setCategories] = useState<any[]>([]);
  
  // Stati per gestire il blocco dinamico dello zoom
  const [dynamicMinZoom, setDynamicMinZoom] = useState(10);
  const isFittingBounds = useRef(false);
  
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  
  // Stato per l'apertura del modale di segnalazione
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

  // 1. Geolocalizzazione Utente
  useEffect(() => {
    if (user?.role === 'GUEST' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setViewState(prev => ({ ...prev, longitude: position.coords.longitude, latitude: position.coords.latitude }));
      });
    }
  }, [user]);

  // 2. Fetch Campus e Fetch Categorie
  useEffect(() => {
    if (user) {
      const fetchCampuses = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/geozone/api/geozones/campuses`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
          const realCampuses = await response.json();
          setCampuses(realCampuses);
          
          if (focusCampusId && realCampuses.some((c: any) => c.id === focusCampusId)) {
            setSelectedCampus(focusCampusId);
          } else if (realCampuses.length > 0) {
            setSelectedCampus(realCampuses[0].id);
          }
        } catch (error) { console.error("Errore recupero campus:", error); }
      };

      const fetchCategories = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/asset/api/categories`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setCategories(await response.json());
          }
        } catch (error) { console.error("Errore recupero categorie:", error); }
      };

      fetchCampuses();
      fetchCategories(); // Recupero parallelo delle categorie per le icone dinamiche
    }
  }, [user, token, focusCampusId]);

  // 3. Fetch Asset Dinamico
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        let url = `${import.meta.env.VITE_API_URL}/asset/api/assets`;
        if (selectedCampus) {
          url += `?campus_id=${selectedCampus}`;
        }
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Errore nel recupero asset');
        const data = await response.json();
        setAssets(data.assets || []);
      } catch (error) { console.error("Errore recupero asset:", error); }
    };
    if (selectedCampus) fetchAssets();
  }, [selectedCampus, token]);

  // 3.5. Focus automatico su Asset da Ticket
  useEffect(() => {
      if (focusAssetId && assets.length > 0) {
        const assetToFocus = assets.find(a => a._id === focusAssetId);
        if (assetToFocus) {
          setSelectedAsset(assetToFocus);
          
          // Svuota lo state della rotta così non lo riapre cambiando campus
          navigate(location.pathname, { replace: true, state: {} });
        }
      }
    }, [focusAssetId, assets, navigate, location.pathname]);

  // 4. INQUADRATURA MAPPA E RECINZIONE NATIVA ABSOLUTA
  useEffect(() => {
    const activeCampus = campuses.find(c => c.id === selectedCampus);
    if (activeCampus?.geometry?.coordinates && mapRef.current) {
      
      const map = mapRef.current.getMap(); // Accediamo al motore C++ della mappa
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

      const extractCoords = (coords: any[]) => {
        if (typeof coords[0] === 'number') {
          if (coords[0] < minLng) minLng = coords[0];
          if (coords[0] > maxLng) maxLng = coords[0];
          if (coords[1] < minLat) minLat = coords[1];
          if (coords[1] > maxLat) maxLat = coords[1];
        } else if (Array.isArray(coords)) {
          coords.forEach(extractCoords);
        }
      };

      extractCoords(activeCampus.geometry.coordinates);

      if (minLng !== Infinity) {
        const lngBuffer = (maxLng - minLng) * 0.10;
        const latBuffer = (maxLat - minLat) * 0.10;
        
        // Limiti nativi di MapLibre
        const bounds: [[number, number], [number, number]] = [
          [minLng - lngBuffer, minLat - latBuffer], // Angolo Sud-Ovest
          [maxLng + lngBuffer, maxLat + latBuffer]  // Angolo Nord-Est
        ];

        // 1. Chiediamo alla mappa a che zoom il recinto diventa più piccolo dello schermo
        const camera = map.cameraForBounds(bounds, { padding: 0 });
        if (camera && camera.zoom) {
          // 2. Blocchiamo lo zoom-out appena prima di quel punto fatale!
          map.setMinZoom(camera.zoom - 0.2); 
        }

        // 3. Alziamo fisicamente la recinzione
        map.setMaxBounds(bounds);

        // 4. Facciamo l'animazione di entrata bella e fluida
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat]
          ],
          { padding: 30, duration: 1000 } 
        );
      }
    }
  }, [selectedCampus, campuses]);

  // 1. Crea un "Dizionario" { id_categoria: icona } calcolato una sola volta
  const categoryIconMap = useMemo(() => {
    const dict: Record<string, string> = {};
    categories.forEach(c => {
      dict[c._id] = c.icon || '📍';
    });
    return dict;
  }, [categories]);

  // 2. Lettura istantanea senza fare cicli di ricerca
  const getAssetIcon = (asset: any) => {
    return categoryIconMap[asset.category_id] || '📍';
  };

  // 3. Memorizziamo anche il perimetro del campus per evitare che venga ricalcolato 60 volte al secondo
  const activeCampusData = useMemo(() => {
    const campus = campuses.find(c => c.id === selectedCampus);
    return campus?.geometry 
      ? { type: 'Feature', geometry: campus.geometry } 
      : null;
  }, [campuses, selectedCampus]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] w-full relative">
      
      {campuses.length > 0 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 shrink-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Filtro Campus
              </label>
              <select
                value={selectedCampus}
                onChange={(e) => { setSelectedCampus(e.target.value); setSelectedAsset(null); }}
                className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
              >
                {campuses.map(campus => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex-1 w-full overflow-hidden border rounded-xl border-stroke shadow-default dark:border-strokedark dark:bg-boxdark">
        <Map 
          ref={mapRef} 
          {...viewState} 
          onMove={evt => setViewState(evt.viewState)} 
          
          onMoveEnd={(evt) => {
            if (isFittingBounds.current) {
              isFittingBounds.current = false;
              setDynamicMinZoom(evt.viewState.zoom);
            }
          }}

          style={{ width: '100%', height: '100%' }} 
          mapStyle="https://tiles.openfreemap.org/styles/liberty" 
          interactive={true}
          dragPan={false}
          minZoom={dynamicMinZoom} 
        >
          {activeCampusData && (
            <Source id="campus-boundary" type="geojson" data={activeCampusData as any}>
              <Layer id="campus-fill" type="fill" paint={{ 'fill-color': '#3C50E0', 'fill-opacity': 0.2 }} />
              <Layer id="campus-outline" type="line" paint={{ 'line-color': '#3C50E0', 'line-width': 2 }} />
            </Source>
          )}

          {assets.map(asset => (
            <Marker 
              key={asset._id} 
              longitude={asset.geometry.coordinates[0]} 
              latitude={asset.geometry.coordinates[1]} 
              onClick={(e) => { 
                e.originalEvent.stopPropagation(); 
                setSelectedAsset(asset);
              }}
            >
              <div className="text-2xl cursor-pointer hover:scale-125 transition-transform">
                {getAssetIcon(asset)}
              </div>
            </Marker>
          ))}
        </Map>
        
        {/* FAB (Floating Action Button) per aggiunta rapida Asset */}
        {user?.role === 'OPERATORE' && (
          <button
            onClick={() => navigate('/assets/new')}
            className="absolute bottom-6 left-6 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-110 hover:bg-blue-700"
            title="Censisci Nuovo Asset"
          >
            <span className="text-3xl font-light leading-none mb-1">+</span>
          </button>
        )}
      </div>

      {/* MODALE GLOBALE CON REACT PORTAL */}
      {selectedAsset && createPortal(
        <>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative flex flex-col w-full max-w-md max-h-[90vh] rounded-xl bg-white shadow-2xl dark:bg-boxdark border border-stroke dark:border-strokedark overflow-hidden">
              
              <div className="flex justify-between items-center p-5 border-b border-stroke dark:border-strokedark bg-white dark:bg-boxdark z-10">
                <h3 className="font-bold text-xl text-black dark:text-white">
                  Dettagli Asset
                </h3>
                <button 
                  onClick={() => setSelectedAsset(null)} 
                  className="text-gray-500 hover:text-black dark:hover:text-white text-xl font-bold bg-gray-100 dark:bg-meta-4 rounded-full w-8 h-8 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                
                {selectedAsset.media_ids && selectedAsset.media_ids.length > 0 && (
                  <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                    {selectedAsset.media_ids.map((mediaId: string) => (
                      <img
                        key={mediaId}
                        src={`${import.meta.env.VITE_API_URL}/media/images/${mediaId}`}
                        alt="Errore di rete con MinIO (Vedi Console)"
                        className="h-48 w-full object-cover rounded-lg shadow-sm border border-stroke dark:border-strokedark bg-gray-100 dark:bg-meta-4 flex items-center justify-center text-xs text-center text-gray-500"
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 text-sm mb-5">
                  {Object.entries(selectedAsset.metadata || {})
                    .filter(([key]) => {
                      // Esclude la riga se la chiave risulta 'unavailable' in una qualsiasi categoria
                      const isDeprecated = categories.some(cat => 
                        cat.attributes?.some((attr: any) => attr.name === key && attr.status === 'unavailable')
                      );
                      return !isDeprecated;
                    })
                    .map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center border-b border-stroke dark:border-strokedark pb-1">
                      <span className="font-semibold text-body capitalize">{key.replace('_', ' ')}</span>
                      <span className="text-black dark:text-white font-medium">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(user?.role === 'GUEST') && (
                <div className="p-5 border-t border-stroke dark:border-strokedark bg-white dark:bg-boxdark z-10">
                  <button 
                    onClick={() => setIsWarningModalOpen(true)} 
                    className="flex w-full justify-center rounded p-3 font-medium text-white transition bg-red-600 hover:bg-red-700"
                  >
                    Segnala un problema
                  </button>
                </div>
              )}

            </div>
          </div>
          
          <WarningFormModal 
            isOpen={isWarningModalOpen} 
            onClose={() => setIsWarningModalOpen(false)} 
            assetId={selectedAsset._id} 
          />
        </>,
        document.body
      )}
    </div>
  );
}