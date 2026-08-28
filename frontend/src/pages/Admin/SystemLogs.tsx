import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";
import LogsTable, { AuditLog } from "../../components/admin/LogsTable";

export default function SystemLogs() {
  const { token } = useAuth();
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Alert Errori
  const [errorMsg, setErrorMsg] = useState("");
  const [exportWarning, setExportWarning] = useState("");

  const fetchLogs = async (page: number) => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg("");
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/log/api/logs?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Errore durante il caricamento dello storico.");
      }
      
      setLogs(data.logs || []);
      setTotalPages(data.total_pages || 1);
      setTotalItems(data.total_items || 0);
      setCurrentPage(data.current_page || 1);
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(currentPage);
  }, [token, currentPage]);

  // =================================================================
  // UC-AMM-07: ESPORTAZIONE CSV
  // =================================================================
  const handleExportCSV = async () => {
    // Controllo Preventivo: Se non ci sono log disabilita l'export
    if (logs.length === 0) {
      setExportWarning("Nessun log trovato, esportazione non disponibile.");
      setTimeout(() => setExportWarning(""), 4000);
      return;
    }

    setIsExporting(true);
    setErrorMsg("");
    setExportWarning("");

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/log/api/logs/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Errore di generazione file. Si prega di riprovare.");
      }

      // Convertiamo la risposta in un Blob (File binario scaricabile)
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Creiamo un link invisibile per innescare il download del browser
      const a = document.createElement('a');
      a.href = url;
      a.download = `Audit_Storico_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      
      // Pulizia
      a.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Storico Operazioni | Asset Management Unisa"
        description="Consulta e scarica l'audit trail completo del sistema."
      />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Storico Operazioni
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Consulta la traccia cronologica e immutabile degli eventi di sistema.
          </p>
        </div>
        
        {/* Pulsante Export (UC-AMM-07) */}
        <button
          onClick={handleExportCSV}
          disabled={isLoading || isExporting}
          className={`inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            logs.length === 0 
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300 dark:bg-slate-700 dark:text-slate-400' 
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700'
          }`}
        >
          {isExporting ? (
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-t-transparent"></div>
          ) : (
            <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {isExporting ? 'Generazione...' : 'Esporta CSV'}
        </button>
      </div>

      {/* Avvisi di Sistema */}
      {errorMsg && (
        <div className="mb-6 rounded-lg border-l-4 border-rose-500 bg-rose-50 p-4 text-rose-800 shadow-sm">
          <p className="font-semibold">{errorMsg}</p>
        </div>
      )}
      {exportWarning && (
        <div className="mb-6 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-800 shadow-sm transition-opacity">
          <p className="font-semibold">{exportWarning}</p>
        </div>
      )}

      {/* Tabella Dati */}
      <LogsTable logs={logs} isLoading={isLoading} />

      {/* Controlli Paginazione */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row bg-white p-4 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Mostrando pagina <span className="font-bold text-slate-800 dark:text-white">{currentPage}</span> di {totalPages} 
            <span className="ml-2 text-xs">({totalItems} record totali)</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            >
              Precedente
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            >
              Successiva
            </button>
          </div>
        </div>
      )}
    </>
  );
}