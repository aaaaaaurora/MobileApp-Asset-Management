import { useRef } from 'react';
import Map from 'react-map-gl/maplibre';
// 1. Importa l'istanza principale di maplibre
import * as maplibregl from 'maplibre-gl';
// 2. Importa il worker forzando Vite a gestirlo correttamente in produzione
import MaplibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker'; 
import 'maplibre-gl/dist/maplibre-gl.css';

// 3. Sostituisce il file .mjs problematico con il worker sicuro di Vite
(maplibregl as any).workerClass = MaplibreWorker;

export default function CampusMap() {
  const mapRef = useRef(null);
  //const { user } = useAuth();

    // Più avanti nel rendering della mappa:
    //{user?.role === 'AMMINISTRATORE' && <AllAssetsMarkers data={assets} />}
    //{user?.role === 'UTENTE' && <ClickToReportTool />}

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] w-full">
      {/* Header della sezione Mappa */}
      <div className="mb-4">
        <h2 className="text-title-md2 font-semibold text-black dark:text-white">
          Mappa del Campus
        </h2>
      </div>

      {/* Contenitore della Mappa */}
      <div className="flex-1 w-full rounded-xl border border-stroke shadow-default overflow-hidden dark:border-strokedark dark:bg-boxdark relative">
        <Map
          ref={mapRef}
          // 4. Diciamo al componente Map di usare la nostra istanza "curata"
          mapLib={maplibregl} 
          initialViewState={{
            longitude: 14.7900, // Longitudine (es. Università di Salerno)
            latitude: 40.7700,  // Latitudine
            zoom: 15,
            pitch: 45,          // Inclinazione per preparare l'effetto 3D
            bearing: 0
          }}
          style={{ width: '100%', height: '100%' }}
          // Utilizziamo lo stile vettoriale di OpenFreeMap (Liberty)
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          interactive={true}
          dragPan={true}
          scrollZoom={true}
        />
      </div>
    </div>
  );
}