import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import Map, { Source, Layer, MapRef, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../../context/AuthContext';

export default function CampusMap() {
  const mapRef = useRef<MapRef>(null);
  const { user, token } = useAuth();
  const location = useLocation();

  // Recupero parametri passati dalla pagina Ticket (se presenti)
  const focusAssetId = location.state?.focusAssetId;
  const focusCampusId = location.state?.focusCampusId;

  const [viewState, setViewState] = useState({ longitude: 14.7900, latitude: 40.7700, zoom: 15, pitch: 45, bearing: 0 });
  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>('');
  
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [formText, setFormText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Geolocalizzazione Utente
  useEffect(() => {
    if (user?.role === 'GUEST' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setViewState(prev => ({ ...prev, longitude: position.coords.longitude, latitude: position.coords.latitude }));
      });
    }
  }, [user]);

  // 2. Fetch Campus (Aperto a tutti gli utenti)
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
          
          // Gestione selezione campus: usa quello del ticket, altrimenti il primo disponibile
          if (focusCampusId && realCampuses.some((c: any) => c.id === focusCampusId)) {
            setSelectedCampus(focusCampusId);
          } else if (realCampuses.length > 0) {
            setSelectedCampus(realCampuses[0].id);
          }
        } catch (error) { console.error("Errore recupero campus:", error); }
      };
      fetchCampuses();
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
      }
    }
  }, [focusAssetId, assets]);

  // 4. Inquadratura Mappa su Confini Campus (fitBounds)
  useEffect(() => {
    const activeCampus = campuses.find(c => c.id === selectedCampus);
    if (activeCampus?.geometry?.coordinates && mapRef.current) {
      const ring = activeCampus.geometry.coordinates[0];
      
      // Troviamo i margini estremi del campus
      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;

      ring.forEach((p: number[]) => {
        if (p[0] < minLng) minLng = p[0];
        if (p[0] > maxLng) maxLng = p[0];
        if (p[1] < minLat) minLat = p[1];
        if (p[1] > maxLat) maxLat = p[1];
      });

      // Diciamo alla mappa di calcolare lo zoom perfetto per far entrare tutto il recinto
      mapRef.current?.fitBounds(
        [
          [minLng, minLat], // Sud-Ovest
          [maxLng, maxLat]  // Nord-Est
        ],
        { 
          padding: 50, // Margine in pixel per non appiccicare il recinto ai bordi dello schermo
          duration: 1500 
        } 
      );
    }
  }, [selectedCampus, campuses]);

  // 5. Invio Modulo Segnalazione / Manutenzione
  const handleActionSubmit = async () => {
    if (!formText.trim() || !selectedAsset) return;
    setIsSubmitting(true);
    
    try {
      const isOperator = user?.role === 'OPERATORE';
      const endpoint = isOperator ? '/warning/maintenances' : '/warning/warnings';
      
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
    <div className="flex flex-col h-[calc(100vh-120px)] w-full relative">
      <div className="flex flex-row items-center justify-between mb-4">
        <h2 className="font-semibold text-title-md2 text-black dark:text-white">Mappa del Campus</h2>
        
        {campuses.length > 0 && (
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
          dragPan={false} // Questa opzione blocca il trascinamento mantenendo abilitato lo scroll zoom
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
                setFormText(''); 
              }}
            >
              <div className="text-2xl cursor-pointer hover:scale-125 transition-transform">
                {getAssetIcon(asset)}
              </div>
            </Marker>
          ))}
        </Map>
      </div>

      {/* MODALE GLOBALE CON REACT PORTAL */}
      {selectedAsset && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative flex flex-col w-full max-w-md max-h-[90vh] rounded-xl bg-white shadow-2xl dark:bg-boxdark border border-stroke dark:border-strokedark overflow-hidden">
            
            {/* Header Fisso */}
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

            {/* Corpo Scorrevole */}
            <div className="flex-1 overflow-y-auto p-5">
              
              {/* Immagini */}
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

              {/* Attributi */}
              <div className="flex flex-col gap-2 text-sm mb-5">
                {Object.entries(selectedAsset.metadata || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center border-b border-stroke dark:border-strokedark pb-1">
                    <span className="font-semibold text-body capitalize">{key.replace('_', ' ')}</span>
                    <span className="text-black dark:text-white font-medium">{String(val)}</span>
                  </div>
                ))}
              </div>

              {/* Aree di Testo */}
              {user?.role === 'OPERATORE' && (
                <div>
                  <span className="block text-xs font-bold text-blue-600 mb-2 uppercase tracking-wider">
                    Registra Manutenzione Preventiva
                  </span>
                  <textarea 
                    value={formText} 
                    onChange={(e) => setFormText(e.target.value)} 
                    placeholder="Scrivi qui la nota tecnica di intervento..." 
                    className="w-full rounded border border-stroke bg-transparent py-2.5 px-3 text-sm outline-none transition focus:border-blue-600 active:border-blue-600 dark:border-form-strokedark dark:bg-form-input text-black dark:text-white resize-none" 
                    rows={4} 
                  />
                </div>
              )}

              {user?.role === 'GUEST' && (
                <div>
                  <span className="block text-xs font-bold text-red-600 mb-2 uppercase tracking-wider">
                    Invia Segnalazione Guasto
                  </span>
                  <textarea 
                    value={formText} 
                    onChange={(e) => setFormText(e.target.value)} 
                    placeholder="Descrivi dettagliatamente il problema riscontrato..." 
                    className="w-full rounded border border-stroke bg-transparent py-2.5 px-3 text-sm outline-none transition focus:border-red-600 active:border-red-600 dark:border-form-strokedark dark:bg-form-input text-black dark:text-white resize-none" 
                    rows={4} 
                  />
                </div>
              )}
            </div>

            {/* Piede Fisso con Pulsante */}
            {(user?.role === 'OPERATORE' || user?.role === 'GUEST') && (
              <div className="p-5 border-t border-stroke dark:border-strokedark bg-white dark:bg-boxdark z-10">
                <button 
                  onClick={handleActionSubmit} 
                  disabled={isSubmitting || !formText.trim()} 
                  className={`flex w-full justify-center rounded p-3 font-medium text-white transition ${user?.role === 'OPERATORE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
                >
                  {isSubmitting 
                    ? 'Operazione in corso...' 
                    : user?.role === 'OPERATORE' ? 'Conferma e Registra Intervento' : 'Invia Segnalazione'}
                </button>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}