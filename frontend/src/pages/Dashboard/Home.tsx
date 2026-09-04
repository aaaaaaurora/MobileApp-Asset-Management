import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";

// Componenti
import AssetMetrics from "../../components/dashboard/AssetMetrics";
import CategoryDistributionChart from "../../components/dashboard/CategoryDistributionChart";
import TimeSeriesChart from "../../components/dashboard/TimeSeriesChart";
import CampusDistributionChart from "../../components/dashboard/CampusDistributionChart";
import DynamicAttributeChart from "../../components/dashboard/DynamicAttributeChart";

const getGreeting = (name?: string) => {
  if (!name) return 'Benvenuta'; 
  
  const lowerName = name.trim().toLowerCase();
  const maleExceptions = ['andrea', 'luca', 'mattia', 'nicola', 'enea', 'elia', 'battista'];
  
  if (maleExceptions.includes(lowerName)) {
    return 'Benvenuto';
  }
  if (lowerName.endsWith('a')) {
    return 'Benvenuta';
  }
  return 'Benvenuta';
};

interface Campus {
  id: string;
  name: string;
}

export default function Home() {
  const { token, user } = useAuth();
  
  const [selectedCampus, setSelectedCampus] = useState<string>(""); 
  const [dynamicAttr, setDynamicAttr] = useState<string>("stato_salute"); 
  
  const [availableCampuses, setAvailableCampuses] = useState<Campus[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const displayFirstName = user?.first_name || (user?.name ? user.name.split(' ')[0] : '');

  useEffect(() => {
    const fetchCampuses = async () => {
      if (!token) return;
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${baseUrl}/geozone/api/geozones/campuses`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setAvailableCampuses(await res.json());
      } catch (error) {
        console.error("Errore nel recupero della lista campus:", error);
      }
    };
    fetchCampuses();
  }, [token]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) return; 

      try {
        setIsLoading(true);
        const headers = { Authorization: `Bearer ${token}` };
        const baseUrl = import.meta.env.VITE_API_URL || '';

        const baseParams = new URLSearchParams();
        if (selectedCampus) baseParams.append('campus_id', selectedCampus);

        const chartParams = new URLSearchParams(baseParams.toString());
        chartParams.append('dynamic_attribute', dynamicAttr);

        const [metricsRes, chartsRes] = await Promise.all([
          fetch(`${baseUrl}/log/api/dashboard/metrics?${baseParams.toString()}`, { headers }),
          fetch(`${baseUrl}/log/api/dashboard/charts?${chartParams.toString()}`, { headers })
        ]);

        if (metricsRes.ok) setMetrics(await metricsRes.json());
        if (chartsRes.ok) setCharts(await chartsRes.json());
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
      
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            {getGreeting(displayFirstName)}, {displayFirstName || 'Amministratore'}!
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Visualizza lo stato di salute dei tuoi Campus e monitora gli asset.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Filtro Campus
            </label>
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
            >
              <option value="">Tutti i Campus</option>
              {availableCampuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          
          <div className="col-span-12">
            <AssetMetrics totals={metrics?.totals} />
          </div>

          <div className="col-span-12 xl:col-span-8">
            <TimeSeriesChart timeSeries={charts?.time_series} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <CategoryDistributionChart distributionData={metrics?.distributions?.by_category} />
          </div>

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

        </div>
      )}
    </>
  );
}