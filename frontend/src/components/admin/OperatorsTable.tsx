import { Operator, Category, Campus } from "../../pages/Admin/OperatorsManagement";

// 🔥 AGGIUNTO `campuses` ALL'INTERFACCIA
interface OperatorsTableProps {
  operators: Operator[];
  categories: Category[];
  campuses: Campus[];
  isLoading: boolean;
  onEditClick: (op: Operator) => void;
}

export default function OperatorsTable({ operators, categories, campuses, isLoading, onEditClick }: OperatorsTableProps) {
  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="max-w-full overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-2 text-left dark:bg-meta-4">
              <th className="py-4 px-4 font-semibold text-black dark:text-white xl:pl-11">Email Operatore</th>
              <th className="py-4 px-4 font-semibold text-black dark:text-white">Categoria Assegnata</th>
              <th className="py-4 px-4 font-semibold text-black dark:text-white min-w-[200px]">Campus Assegnati</th>
              <th className="py-4 px-4 font-semibold text-black dark:text-white">Stato</th>
              <th className="py-4 px-4 font-semibold text-black dark:text-white text-center">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">Caricamento in corso...</td>
              </tr>
            ) : operators.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">Nessun operatore configurato.</td>
              </tr>
            ) : (
              operators.map((op) => {
                const catName = categories.find((c) => c.id === op.category_id)?.name || "Nessuna";
                return (
                  <tr key={op.id} className="hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-colors">
                    
                    {/* EMAIL */}
                    <td className="border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11">
                      <p className="font-medium text-black dark:text-white">{op.email}</p>
                    </td>
                    
                    {/* CATEGORIA */}
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <p className="text-gray-700 dark:text-gray-300">{catName}</p>
                    </td>
                    
                    {/* CAMPUS ASSEGNATI */}
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      {op.campus_ids.length === 0 ? (
                        <span className="inline-flex rounded-full bg-warning/10 py-1 px-3 text-xs font-medium text-warning">
                          Nessuno
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {op.campus_ids.map(id => {
                            const cName = campuses.find((c) => c.id === id)?.name || id;
                            return (
                              <span key={id} className="inline-flex items-center rounded-md bg-primary/10 py-1 px-2.5 text-xs font-medium text-primary border border-primary/20">
                                {cName}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    
                    {/* STATO */}
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <span className={`inline-flex rounded-full py-1 px-3 text-xs font-medium ${op.is_active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                        {op.is_active ? 'Attivo' : 'Disabilitato'}
                      </span>
                    </td>
                    
                    {/* AZIONI (Icona Matita) */}
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark text-center">
                      <button
                        onClick={() => onEditClick(op)}
                        title="Modifica Permessi"
                        className="inline-flex items-center justify-center p-2 rounded-full text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-meta-4 dark:hover:text-primary transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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