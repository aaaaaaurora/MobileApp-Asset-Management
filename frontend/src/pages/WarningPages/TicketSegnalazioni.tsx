import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface Ticket {
  id: string;
  asset_id: string;
  descrizione: string;
  status: 'aperta' | 'chiusa';
  campus_id: string;
  created_at: string;
}

interface Campus {
  id: string;
  name: string;
}

interface Category {
  _id: string;
  name: string;
}

export default function TicketSegnalazioni() {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stati per i filtri
  const [selectedCampus, setSelectedCampus] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [notaIntervento, setNotaIntervento] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // NUOVO STATO: Gestione apertura modale di notifica (successo o errore)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Recupero dati statici per i filtri (Campus e Categorie)
  useEffect(() => {
    const fetchStaticData = async () => {
      try {
        const [campRes, catRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/geozone/api/geozones/campuses`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${import.meta.env.VITE_API_URL}/asset/api/categories`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        if (campRes.ok) setCampuses(await campRes.json());
        if (catRes.ok) setCategories(await catRes.json());
      } catch (error) {
        console.error("Errore nel recupero dati statici:", error);
      }
    };

    if (token) fetchStaticData();
  }, [token]);

  // Recupero Ticket con l'applicazione dei filtri
  useEffect(() => {
    fetchTickets();
  }, [token, selectedCampus, selectedCategory, selectedStatus]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (selectedCampus) params.append('campus_id', selectedCampus);
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);

      const url = `${import.meta.env.VITE_API_URL}/warning/warnings${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Errore nel recupero dei ticket');
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedTicket || !notaIntervento.trim()) return;
    setIsResolving(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/warning/warnings/${selectedTicket.id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nota_intervento: notaIntervento })
      });

      if (!response.ok) throw new Error('Errore durante la chiusura del ticket');

      // Aggiornamento dinamico senza ricaricare
      setTickets(prev => prev.map(t => 
        t.id === selectedTicket.id ? { ...t, status: 'chiusa' } : t
      ));
      
      closeModal();
      setNotification({ type: 'success', message: 'Intervento registrato e ticket chiuso con successo!' });
    } catch (error: any) {
      setNotification({ type: 'error', message: error.message });
    } finally {
      setIsResolving(false);
    }
  };

  const closeModal = () => {
    setSelectedTicket(null);
    setNotaIntervento('');
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Segnalazioni
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gestisci i ticket aperti e visualizza lo storico degli interventi registrati.
          </p>
        </div>
      </div>

      {/* SEZIONE FILTRI COMPATTA */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtro Campus</label>
            <select 
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
            >
              <option value="">Tutti i Campus</option>
              {campuses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtro Categoria</label>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
            >
              <option value="">Tutte le Categorie</option>
              {categories.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Stato segnalazione</label>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
            >
              <option value="">Tutti gli Stati</option>
              <option value="aperta">Solo Aperte</option>
              <option value="chiusa">Solo Chiuse</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 dark:bg-slate-700 dark:text-white dark:border-slate-600">
              <tr>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs">Data</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs">Descrizione Problema</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs text-center">Stato</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs text-center">Posizione</th>
                <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-t-transparent"></div></div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center font-medium text-slate-500">
                    Nessuna segnalazione trovata.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{new Date(ticket.created_at).toLocaleDateString('it-IT')}</p>
                      <p className="text-xs font-medium text-slate-500">{new Date(ticket.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute:'2-digit' })}</p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs" title={ticket.descrizione}>{ticket.descrizione}</p>
                      <p className="text-xs text-slate-500 mt-1 font-mono">Asset: {ticket.asset_id.substring(0, 8)}...</p>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${ticket.status === 'aperta' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => navigate('/map', { state: { focusAssetId: ticket.asset_id, focusCampusId: ticket.campus_id } })}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        📍 Mappa
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {ticket.status === 'aperta' ? (
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                      >
                        Gestisci
                      </button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 italic">Problema risolto</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALE GESTIONE TICKET */}
      {selectedTicket && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transform transition-all">
            
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Risoluzione Ticket</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors">✕</button>
            </div>
            
            <div className="mb-5">
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Descrizione Utente:</span>
              <p className="text-sm text-slate-700 dark:text-slate-300 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 leading-relaxed">
                {selectedTicket.descrizione}
              </p>
            </div>
            
            <div className="mb-6">
              <label className="mb-2 block text-sm font-bold text-blue-600 dark:text-blue-400">Nota Tecnica di Intervento (Correttivo) <span className="text-rose-500">*</span></label>
              <textarea 
                rows={4} 
                value={notaIntervento} 
                onChange={(e) => setNotaIntervento(e.target.value)} 
                placeholder="Descrivi dettagliatamente l'intervento effettuato per risolvere il problema..."
                className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800" 
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={closeModal} 
                disabled={isResolving} 
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button 
                onClick={handleResolve} 
                disabled={isResolving || !notaIntervento.trim()} 
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isResolving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Chiusura...
                  </>
                ) : 'Conferma e Chiudi'}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* MODALE DI NOTIFICA (SUCCESSO / ERRORE) */}
      {notification && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden text-center p-6">
            {notification.type === 'success' ? (
              <svg className="mx-auto mb-4 w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            ) : (
              <svg className="mx-auto mb-4 w-12 h-12 text-rose-600 dark:text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            )}
            <h3 className="mb-2 text-lg font-bold text-slate-800 dark:text-white">
              {notification.type === 'success' ? 'Operazione Completata' : 'Errore'}
            </h3>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              {notification.message}
            </p>
            <button
              onClick={() => setNotification(null)}
              className={`rounded-lg px-6 py-2 text-sm font-bold text-white shadow-sm transition-all focus:ring-2 focus:ring-offset-2 w-full sm:w-auto ${
                notification.type === 'success' 
                  ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' 
                  : 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
              }`}
            >
              Chiudi
            </button>
          </div>
        </div>, document.body
      )}
    </>
  );
}