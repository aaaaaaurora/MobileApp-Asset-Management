import { useState, useEffect, useRef } from 'react';
import Map, { Source, Layer, MapRef, Marker, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../../context/AuthContext';

export default function CampusMap() {
  const mapRef = useRef<MapRef>(null);
  const { user, token } = useAuth();

  // Stati della Mappa e del Campus
  const [viewState, setViewState] = useState({ longitude: 14.7900, latitude: 40.7700, zoom: 15, pitch: 45, bearing: 0 });
  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>('');
  
  // Stati per Asset e Moduli nel Popup
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [formText, setFormText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Geolocalizzazione Utente
  useEffect(() => {
    if (user?.role === 'UTENTE' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setViewState(prev => ({ ...prev, longitude: position.coords.longitude, latitude: position.coords.latitude }));
      });
    }
  }, [user]);

  // 2. Fetch Campus (Operatore / Amministratore)
  useEffect(() => {
    if (user && (user.role === 'OPERATORE' || user.role === 'AMMINISTRATORE')) {
      const fetchCampuses = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/geozone/api/geozones/campuses`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
          const realCampuses = await response.json();
          setCampuses(realCampuses);
          if (realCampuses.length > 0) setSelectedCampus(realCampuses[0].id);
        } catch (error) { console.error("Errore recupero campus:", error); }
      };
      fetchCampuses();
    }
  }, [user, token]);

  // 3. Fetch Asset Dinamico
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        let url = `${import.meta.env.VITE_API_URL}/asset/api/assets`;
        if (user?.role !== 'UTENTE' && selectedCampus) {
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
    if (user?.role === 'UTENTE' || selectedCampus) fetchAssets();
  }, [selectedCampus, user, token]);

  // 4. Centratura Mappa al cambio campus (Effetto FlyTo)
  useEffect(() => {
    const activeCampus = campuses.find(c => c.id === selectedCampus);
    if (activeCampus?.geometry?.coordinates && mapRef.current) {
      const ring = activeCampus.geometry.coordinates[0];
      const avgLng = ring.reduce((sum: number, p: number[]) => sum + p[0], 0) / ring.length;
      const avgLat = ring.reduce((sum: number, p: number[]) => sum + p[1], 0) / ring.length;
      mapRef.current?.flyTo({ center: [avgLng, avgLat], zoom: 15, duration: 1500 });
    }
  }, [selectedCampus, campuses]);

  // 5. Invio Modulo (Manutenzione o Segnalazione)
  const handleActionSubmit = async () => {
    if (!formText.trim() || !selectedAsset) return;
    setIsSubmitting(true);
    
    try {
      const isOperator = user?.role === 'OPERATORE';
      
      // NOTA: Verifica che i prefissi "/asset" e "/warning" corrispondano a quelli registrati sul tuo Gateway
      const endpoint = isOperator ? '/asset/maintenances' : '/warning/warnings';
      
      const payload = isOperator 
        ? { asset_id: selectedAsset._id, tipo_intervento: 'preventiva', nota_intervento: formText }
        : { asset_id: selectedAsset._id, descrizione: formText };

      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Errore salvataggio');
      alert(isOperator ? 'Intervento Preventivo registrato!' : 'Segnalazione inviata!');
      setFormText('');
      setSelectedAsset(null);
    } catch (error) {
      alert("Errore durante l'operazione.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Assegnazione Dinamica Icone
  const getAssetIcon = (asset: any) => {
    const type = asset.metadata?.tipologia?.toLowerCase() || '';
    if (type.includes('alber') || type.includes('pin')) return '🌲';
    if (type.includes('illuminazione') || type.includes('pal')) return '💡';
    return '📍';
  };

  const activeCampusData = campuses.find(c => c.id === selectedCampus)?.geometry 
    ? { type: 'Feature', geometry: campuses.find(c => c.id === selectedCampus).geometry } 
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] w-full">
      <div className="flex flex-row items-center justify-between mb-4">
        <h2 className="font-semibold text-title-md2 text-black dark:text-white">Mappa del Campus</h2>
        
        {/* Selettore Campus (nascosto agli Utenti) */}
        {(user?.role === 'OPERATORE' || user?.role === 'AMMINISTRATORE') && campuses.length > 0 && (
          <select 
            value={selectedCampus} 
            onChange={(e) => { setSelectedCampus(e.target.value); setSelectedAsset(null); }} 
            className="px-4 py-2 bg-white border rounded-lg shadow-sm border-stroke text-black dark:bg-boxdark dark:border-strokedark dark:text-white"
          >
            {campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
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
        >
          
          {/* Poligono Campus */}
          {activeCampusData && (
            <Source id="campus-boundary" type="geojson" data={activeCampusData as any}>
              <Layer id="campus-fill" type="fill" paint={{ 'fill-color': '#3C50E0', 'fill-opacity': 0.2 }} />
              <Layer id="campus-outline" type="line" paint={{ 'line-color': '#3C50E0', 'line-width': 2 }} />
            </Source>
          )}

          {/* Markers degli Asset */}
          {assets.map(asset => (
            <Marker 
              key={asset._id} 
              longitude={asset.geometry.coordinates[0]} 
              latitude={asset.geometry.coordinates[1]} 
              onClick={(e) => { 
                e.originalEvent.stopPropagation(); 
                setSelectedAsset(asset);
                setFormText(''); // Pulisce il form quando si cambia asset
              }}
            >
              <div className="text-2xl cursor-pointer hover:scale-125 transition-transform">
                {getAssetIcon(asset)}
              </div>
            </Marker>
          ))}

          {/* Popup Interattivo In Stile Tailadmin */}
          {selectedAsset && (
            <Popup 
              longitude={selectedAsset.geometry.coordinates[0]} 
              latitude={selectedAsset.geometry.coordinates[1]} 
              closeOnClick={false} 
              onClose={() => setSelectedAsset(null)}
              className="z-50"
              maxWidth="320px"
              anchor="bottom"
              offset={15}
            >
              <div className="flex flex-col gap-3 p-1">
                <h3 className="font-semibold text-lg text-black dark:text-white border-b border-stroke dark:border-strokedark pb-2">
                  Dettagli Asset
                </h3>

                {/* Sezione Immagini */}
                {selectedAsset.media_ids && selectedAsset.media_ids.length > 0 && (
                  <div className="flex overflow-x-auto gap-2 pb-1">
                    {selectedAsset.media_ids.map((mediaId: string) => (
                      <img
                        key={mediaId}
                        src={`${import.meta.env.VITE_API_URL}/media/images/${mediaId}`}
                        alt="Asset"
                        className="h-32 w-full object-cover rounded-sm shadow-sm border border-stroke dark:border-strokedark"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ))}
                  </div>
                )}

                {/* Sezione Attributi Dinamici */}
                <div className="flex flex-col gap-1 text-sm max-h-32 overflow-y-auto pr-1">
                  {Object.entries(selectedAsset.metadata || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center border-b border-stroke dark:border-strokedark pb-1 last:border-0">
                      <span className="font-medium text-body capitalize">{key.replace('_', ' ')}</span>
                      <span className="text-black dark:text-white font-medium">{String(val)}</span>
                    </div>
                  ))}
                </div>

                {/* Modulo Operatore (Manutenzione Preventiva Diretta) */}
                {user?.role === 'OPERATORE' && (
                  <div className="mt-1 border-t border-stroke dark:border-strokedark pt-3">
                    <span className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">
                      Manutenzione Preventiva
                    </span>
                    <textarea 
                      value={formText} 
                      onChange={(e) => setFormText(e.target.value)} 
                      placeholder="Nota tecnica di intervento..." 
                      className="w-full rounded border border-stroke bg-transparent py-2 px-3 text-sm outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input mb-3 text-black dark:text-white" 
                      rows={2} 
                    />
                    <button 
                      onClick={handleActionSubmit} 
                      disabled={isSubmitting || !formText.trim()} 
                      className="flex w-full justify-center rounded bg-primary p-2 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Salvataggio...' : 'Registra Intervento'}
                    </button>
                  </div>
                )}

                {/* Modulo Utente (Segnalazione Guasti) */}
                {user?.role === 'UTENTE' && (
                  <div className="mt-1 border-t border-stroke dark:border-strokedark pt-3">
                    <span className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">
                      Segnala Problema
                    </span>
                    <textarea 
                      value={formText} 
                      onChange={(e) => setFormText(e.target.value)} 
                      placeholder="Descrivi il problema riscontrato..." 
                      className="w-full rounded border border-stroke bg-transparent py-2 px-3 text-sm outline-none transition focus:border-danger active:border-danger dark:border-form-strokedark dark:bg-form-input mb-3 text-black dark:text-white" 
                      rows={2} 
                    />
                    <button 
                      onClick={handleActionSubmit} 
                      disabled={isSubmitting || !formText.trim()} 
                      className="flex w-full justify-center rounded bg-danger p-2 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Invio in corso...' : 'Invia Segnalazione'}
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}