import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';

interface Ticket {
  id: string;
  asset_id: string;
  descrizione: string;
  status: 'aperta' | 'chiusa';
  campus_id: string;
  created_at: string;
}

export default function TicketSegnalazioni() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stati per la gestione della modale di risoluzione
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [notaIntervento, setNotaIntervento] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // 1. Fetch iniziale dei ticket
  useEffect(() => {
    fetchTickets();
  }, [token]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/warning/warnings`, {
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

  // 2. Chiusura formale della segnalazione
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante la chiusura del ticket');
      }

      // Aggiorna lo stato locale senza ricaricare la pagina
      setTickets(prev => prev.map(t => 
        t.id === selectedTicket.id ? { ...t, status: 'chiusa' } : t
      ));
      
      closeModal();
      alert('Intervento registrato e ticket chiuso con successo!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsResolving(false);
    }
  };

  const closeModal = () => {
    setSelectedTicket(null);
    setNotaIntervento('');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-title-md2 font-semibold text-black dark:text-white">
          Ticket Segnalazioni
        </h2>
        <button onClick={fetchTickets} className="text-sm text-blue-600 hover:underline">
          Aggiorna Lista
        </button>
      </div>

      {/* Tabella Tailadmin */}
      <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="py-4 px-4 font-medium text-black dark:text-white xl:pl-11">Data</th>
                <th className="py-4 px-4 font-medium text-black dark:text-white">Descrizione Problema</th>
                <th className="py-4 px-4 font-medium text-black dark:text-white">Stato</th>
                <th className="py-4 px-4 font-medium text-black dark:text-white">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-5 text-center text-gray-500">Caricamento ticket in corso...</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-5 text-center text-gray-500">Nessuna segnalazione presente nel tuo campus.</td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11">
                      <p className="text-sm text-black dark:text-white">
                        {new Date(ticket.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(ticket.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute:'2-digit' })}</p>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <p className="text-sm text-black dark:text-white truncate max-w-xs" title={ticket.descrizione}>
                        {ticket.descrizione}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Asset ID: {ticket.asset_id.substring(0, 8)}...</p>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <span className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${
                        ticket.status === 'aperta' ? 'bg-yellow-500 text-yellow-600' : 'bg-green-500 text-green-600'
                      }`}>
                        {ticket.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      {ticket.status === 'aperta' ? (
                        <button
                          onClick={() => setSelectedTicket(ticket)}
                          className="rounded bg-blue-600 py-1 px-3 text-xs font-medium text-white hover:bg-blue-700 transition"
                        >
                          Gestisci Guasto
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">Risolto</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale di Risoluzione (React Portal) */}
      {selectedTicket && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-boxdark border border-stroke dark:border-strokedark">
            <div className="flex justify-between items-center mb-4 border-b border-stroke dark:border-strokedark pb-3">
              <h3 className="font-bold text-lg text-black dark:text-white">
                Risoluzione Ticket
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-black dark:hover:text-white font-bold">✕</button>
            </div>
            
            <div className="mb-4">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Descrizione Utente:</span>
              <p className="text-sm text-black dark:text-white p-3 bg-gray-100 dark:bg-meta-4 rounded border border-stroke dark:border-strokedark">
                {selectedTicket.descrizione}
              </p>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-bold text-blue-600 dark:text-blue-500">
                Nota Tecnica di Intervento (Correttivo) *
              </label>
              <textarea
                rows={4}
                placeholder="Descrivi l'intervento effettuato per risolvere il guasto..."
                value={notaIntervento}
                onChange={(e) => setNotaIntervento(e.target.value)}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-4 font-medium outline-none transition focus:border-blue-600 active:border-blue-600 disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={closeModal}
                disabled={isResolving}
                className="rounded border border-stroke py-2 px-6 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white transition"
              >
                Annulla
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving || !notaIntervento.trim()}
                className="rounded bg-blue-600 py-2 px-6 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {isResolving ? 'Chiusura in corso...' : 'Conferma e Chiudi'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}