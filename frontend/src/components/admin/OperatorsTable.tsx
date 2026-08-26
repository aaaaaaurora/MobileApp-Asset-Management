import { Operator, Category, Campus } from "../../pages/Admin/OperatorsManagement";

interface OperatorsTableProps {
  operators: Operator[];
  categories: Category[];
  campuses: Campus[];
  isLoading: boolean;
  onEditClick: (op: Operator) => void;
}

export default function OperatorsTable({ operators, categories, campuses, isLoading, onEditClick }: OperatorsTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          
          {/* INTESTAZIONE SCURA - FORTE CONTRASTO */}
          <thead className="bg-slate-800 text-white dark:bg-slate-900">
            <tr>
              <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs">Email Operatore</th>
              <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs">Categoria Assegnata</th>
              <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs w-[30%]">Campus Assegnati</th>
              <th className="py-4 px-6 font-semibold uppercase tracking-wider text-xs">Stato</th>
              {/* Tolta la scritta "Azioni", lasciato vuoto per pulizia */}
              <th className="py-4 px-6 font-semibold text-center w-20"></th>
            </tr>
          </thead>
          
          {/* CORPO TABELLA CON DIVISORI E ZEBRA-STRIPING */}
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center font-medium text-slate-500">Caricamento operatori in corso...</td>
              </tr>
            ) : operators.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center font-medium text-slate-500">Nessun operatore configurato.</td>
              </tr>
            ) : (
              operators.map((op, index) => {
                const catName = categories.find((c) => c.id === op.category_id)?.name || "Nessuna specifica";
                
                return (
                  <tr 
                    key={op.id} 
                    // Righe alternate (bianco e grigio chiarissimo)
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors`}
                  >
                    <td className="py-4 px-6">
                      <span className="font-semibold text-slate-800 dark:text-white">{op.email}</span>
                    </td>
                    
                    <td className="py-4 px-6 font-medium text-slate-600 dark:text-slate-300">
                      {catName}
                    </td>
                    
                    <td className="py-4 px-6">
                      {op.campus_ids.length === 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                          Nessuno
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {op.campus_ids.map(id => {
                            // Se il backend manda l'UUID grezzo e non troviamo il nome, ne stampiamo solo un pezzetto visibile
                            const rawCampus = campuses.find((c) => c.id === id);
                            const cName = rawCampus ? rawCampus.name : `Campus (${id.substring(0, 5)}...)`;
                            
                            return (
                              <span key={id} className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 border border-blue-200 shadow-sm">
                                {cName}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${
                        op.is_active 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}>
                        {op.is_active ? 'Attivo' : 'Disabilitato'}
                      </span>
                    </td>
                    
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => onEditClick(op)}
                        title="Modifica Permessi"
                        className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-blue-600 transition-all focus:ring-2 focus:ring-blue-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}