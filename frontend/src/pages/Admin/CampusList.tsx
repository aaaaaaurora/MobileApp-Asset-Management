import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";

interface Campus {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export default function CampusListPage() {
  const { token } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchCampuses = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/geozone/api/geozones/campuses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Errore nel caricamento dei campus.");
      
      setCampuses(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampuses();
  }, [token]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare definitivamente il campus "${name}" e tutti gli asset associati? L'operazione è irreversibile.`)) {
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/geozone/api/geozones/campuses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore durante l'eliminazione.");
      }

      // Ricarica la lista per mostrare i dati aggiornati
      fetchCampuses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleDateString('it-IT', { 
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
    <>
      <PageMeta title="Gestione Campus | Asset Management" description="Visualizza e gestisci i campus universitari." />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Poli Territoriali
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Elenco delle aree geografiche registrate come campus.
          </p>
        </div>
        
        <Link
          to="/admin/campus/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Registra Nuovo Campus
        </Link>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border-l-4 border-rose-500 bg-rose-50 p-4 text-rose-800 shadow-sm">
          <p className="font-semibold">{errorMsg}</p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 dark:bg-slate-700 dark:text-white dark:border-slate-600">
              <tr>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs">Nome Campus</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs">Descrizione</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs">Data Registrazione</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs text-right">Azioni</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-t-transparent"></div></div>
                  </td>
                </tr>
              ) : campuses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center font-medium text-slate-500">
                    Nessun campus registrato a sistema.
                  </td>
                </tr>
              ) : (
                campuses.map((campus) => (
                  <tr key={campus.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200">{campus.name}</td>
                    <td className="py-4 px-6 text-slate-500 italic">{campus.description || "Nessuna descrizione"}</td>
                    <td className="py-4 px-6">{formatDate(campus.created_at)}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDelete(campus.id, campus.name)}
                        className="inline-flex items-center text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 font-semibold text-xs uppercase"
                      >
                        <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}