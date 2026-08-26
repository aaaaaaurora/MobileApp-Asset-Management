import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";

// Componenti
import AssetMetrics from "../../components/dashboard/AssetMetrics";
import CategoryDistributionChart from "../../components/dashboard/CategoryDistributionChart";
import TimeSeriesChart from "../../components/dashboard/TimeSeriesChart";
import CampusDistributionChart from "../../components/dashboard/CampusDistributionChart";
import DynamicAttributeChart from "../../components/dashboard/DynamicAttributeChart";
import RecentLogsTable from "../../components/dashboard/RecentLogsTable";

// Funzione euristica per determinare il genere dal nome italiano
const getGreeting = (name?: string) => {
  if (!name) return 'Benvenuto/a'; 
  
  const lowerName = name.trim().toLowerCase();
  
  const maleExceptions = ['andrea', 'luca', 'mattia', 'nicola', 'enea', 'elia', 'battista'];
  
  if (maleExceptions.includes(lowerName)) {
    return 'Benvenuto';
  }
  
  if (lowerName.endsWith('a')) {
    return 'Benvenuta';
  }
  
  return 'Benvenuto';
};

// Interfaccia essenziale per i Campus
interface Campus {
  id: string;
  name: string;
}

export default function Home() {
  const { token, user } = useAuth();
  
  // STATI DEL FILTRO
  const [selectedCampus, setSelectedCampus] = useState<string>(""); 
  const [dynamicAttr, setDynamicAttr] = useState<string>("status"); 
  
  // Stato per memorizzare i campus reali provenienti dal database
  const [availableCampuses, setAvailableCampuses] = useState<Campus[]>([]);
  
  // STATI DEI DATI DELLA DASHBOARD
  const [metrics, setMetrics] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // EFFETTO 1: Scarica la lista dei campus UNA SOLA VOLTA al caricamento
  useEffect(() => {
    const fetchCampuses = async () => {
      if (!token) return;
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${baseUrl}/geozone/api/geozones/campuses`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setAvailableCampuses(data);
        }
      } catch (error) {
        console.error("Errore nel recupero della lista campus:", error);
      }
    };

    fetchCampuses();
  }, [token]);

  // EFFETTO 2: Scarica i dati della Dashboard ogni volta che cambia il Filtro
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) return; 

      try {
        setIsLoading(true);
        const headers = { Authorization: `Bearer ${token}` };
        const baseUrl = import.meta.env.VITE_API_URL || '';

        // Costruiamo i parametri per l'URL dinamicamente
        const baseParams = new URLSearchParams();
        if (selectedCampus) baseParams.append('campus_id', selectedCampus);

        const chartParams = new URLSearchParams(baseParams.toString());
        chartParams.append('dynamic_attribute', dynamicAttr);

        const logParams = new URLSearchParams(baseParams.toString());
        logParams.append('limit', '5');

        const [metricsRes, chartsRes, logsRes] = await Promise.all([
          fetch(`${baseUrl}/log/api/dashboard/metrics?${baseParams.toString()}`, { headers }),
          fetch(`${baseUrl}/log/api/dashboard/charts?${chartParams.toString()}`, { headers }),
          fetch(`${baseUrl}/log/api/logs?${logParams.toString()}`, { headers })
        ]);

        if (metricsRes.ok) setMetrics(await metricsRes.json());
        if (chartsRes.ok) setCharts(await chartsRes.json());
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setRecentLogs(logsData.logs); 
        }
      } catch (error) {
        console.error("Errore nel caricamento della dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, selectedCampus, dynamicAttr]);

  return (
    <>
      <PageMeta
        title="Dashboard Amministratore | Asset Management Unisa"
        description="Pannello di controllo riepilogativo per la gestione degli asset del campus."
      />
      
      {/* HEADER DELLA DASHBOARD CON FILTRO CAMPUS */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-black dark:text-white">
            {getGreeting(user?.first_name)}, {user?.first_name || 'Amministratore'}!
          </h2>
          <p className="text-sm text-gray-500">
            Visualizza lo stato di salute dei tuoi Campus.
          </p>
        </div>

        {/* IL SELETTORE TERRITORIALE DINAMICO */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-black dark:text-white">Filtro Campus:</label>
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="rounded-lg border border-stroke bg-white py-2 px-4 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark"
          >
            <option value="">🌍 Tutti i Campus (Aggregata)</option>
            {/* Mappiamo dinamicamente i campus presi dal database */}
            {availableCampuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          
          {/* RIGA 1: KPI Generali */}
          <div className="col-span-12">
            <AssetMetrics totals={metrics?.totals} />
          </div>

          {/* RIGA 2: Andamento Temporale (8 colonne) + Torta Categorie (4 colonne) */}
          <div className="col-span-12 xl:col-span-8">
            <TimeSeriesChart timeSeries={charts?.time_series} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <CategoryDistributionChart distributionData={metrics?.distributions?.by_category} />
          </div>

          {/* RIGA 3: Barre Campus (6 col) + Grafico Dinamico Attributi (6 col) */}
          {selectedCampus === "" && (
            <div className="col-span-12 xl:col-span-6">
              <CampusDistributionChart distributionData={metrics?.distributions?.by_campus} />
            </div>
          )}
          
          <div className={`col-span-12 ${selectedCampus === "" ? 'xl:col-span-6' : 'xl:col-span-12'}`}>
            <DynamicAttributeChart 
              attributeName={dynamicAttr} 
              onAttributeChange={setDynamicAttr}
              distributionData={charts?.dynamic_distribution?.data} 
            />
          </div>

          {/* RIGA 4: Tabella Ultime Operazioni */}
          <div className="col-span-12">
            <RecentLogsTable logs={recentLogs} />
          </div>

        </div>
      )}
    </>
  );
}