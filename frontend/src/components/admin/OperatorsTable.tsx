import { Operator, Category } from "../../pages/Admin/OperatorsManagement";

interface OperatorsTableProps {
  operators: Operator[];
  categories: Category[];
  isLoading: boolean;
  onEditClick: (op: Operator) => void;
}

export default function OperatorsTable({ operators, categories, isLoading, onEditClick }: OperatorsTableProps) {
  return (
    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="max-w-full overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-2 text-left dark:bg-meta-4">
              <th className="py-4 px-4 font-medium text-black dark:text-white xl:pl-11">Email Operatore</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white">Categoria Assegnata</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white">Campus Visibili</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white">Stato</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white text-center">Azioni</th>
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
                // Troviamo il nome della categoria a partire dal suo ID
                const catName = categories.find((c) => c.id === op.category_id)?.name || "Nessuna";
                return (
                  <tr key={op.id}>
                    <td className="border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11">
                      <p className="font-medium text-black dark:text-white">{op.email}</p>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <p className="text-black dark:text-white">{catName}</p>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      {op.campus_ids.length === 0 ? (
                        <span className="inline-flex rounded-full bg-warning/10 py-1 px-3 text-sm font-medium text-warning">
                          Zero Campus
                        </span>
                      ) : (
                        <p className="text-black dark:text-white">{op.campus_ids.length} Campus</p>
                      )}
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <span className={`inline-flex rounded-full py-1 px-3 text-sm font-medium ${op.is_active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                        {op.is_active ? 'Attivo' : 'Disabilitato'}
                      </span>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark text-center">
                      <button
                        onClick={() => onEditClick(op)}
                        className="text-primary hover:text-primary/80 font-medium transition-colors"
                      >
                        Modifica
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