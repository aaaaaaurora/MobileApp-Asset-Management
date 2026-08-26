import { useState, useEffect } from "react";
import { Category, Campus, OperatorFormData } from "../../pages/Admin/OperatorsManagement";

interface OperatorModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialData: OperatorFormData;
  categories: Category[];
  campuses: Campus[];
  error: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: OperatorFormData) => void;
}

export default function OperatorModal({
  isOpen,
  isEditing,
  initialData,
  categories,
  campuses,
  error,
  isSubmitting,
  onClose,
  onSubmit
}: OperatorModalProps) {
  
  const [formData, setFormData] = useState<OperatorFormData>(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleCampusToggle = (campusId: string) => {
    setFormData((prev) => {
      const isSelected = prev.campus_ids.includes(campusId);
      return {
        ...prev,
        campus_ids: isSelected
          ? prev.campus_ids.filter((id) => id !== campusId)
          : [...prev.campus_ids, campusId],
      };
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-lg flex flex-col max-h-[90vh] rounded-xl bg-white shadow-default dark:bg-boxdark">
        
        {/* HEADER MODALE */}
        <div className="px-6 py-5 border-b border-stroke dark:border-strokedark">
          <h3 className="text-xl font-bold text-black dark:text-white">
            {isEditing ? "Modifica Permessi Operatore" : "Registrazione Nuovo Operatore"}
          </h3>
        </div>

        {/* CORPO SCORREVOLE */}
        <div className="overflow-y-auto p-6 flex-1">
          <form id="operatorForm" onSubmit={handleFormSubmit}>
            {error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-black dark:text-white">
                Indirizzo Email (Account SSO)
              </label>
              <input
                type="email"
                required
                disabled={isEditing}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="es. operatore@unisa.it"
                className="w-full rounded-lg border border-stroke bg-gray-50 py-3 px-4 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-not-allowed disabled:bg-gray-200 dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary dark:disabled:bg-meta-4"
              />
              {!isEditing && (
                <p className="mt-1.5 text-xs text-gray-500">
                  L'utente accederà tramite Google. Non serve impostare una password.
                </p>
              )}
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-black dark:text-white">
                Categoria di Competenza
              </label>
              <div className="relative z-20 bg-transparent">
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="relative z-20 w-full appearance-none rounded-lg border border-stroke bg-transparent py-3 px-4 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                >
                  <option value="">-- Nessuna Categoria --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <span className="absolute top-1/2 right-4 z-10 -translate-y-1/2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="mb-2">
              <label className="mb-2 block text-sm font-semibold text-black dark:text-white">
                Campus Assegnati
              </label>
              <p className="mb-3 text-xs text-gray-500">
                Seleziona i perimetri geografici di competenza.
              </p>
              
              <div className="flex flex-col gap-2 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-form-strokedark dark:bg-meta-4/30">
                {campuses.length === 0 ? (
                  <span className="text-sm italic text-gray-500">Nessun campus configurato nel sistema.</span>
                ) : (
                  campuses.map((campus) => (
                    <label key={campus.id} className="flex cursor-pointer items-center gap-3 py-1">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.campus_ids.includes(campus.id)}
                          onChange={() => handleCampusToggle(campus.id)}
                          className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-stroke bg-white checked:border-primary checked:bg-primary dark:border-strokedark dark:bg-boxdark"
                        />
                        {/* Custom SVG Checkmark */}
                        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-black dark:text-white select-none">
                        {campus.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </form>
        </div>

        {/* FOOTER MODALE CON BOTTONI FISSI */}
        <div className="px-6 py-4 border-t border-stroke dark:border-strokedark bg-gray-50 dark:bg-boxdark rounded-b-xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-stroke bg-white px-6 py-2.5 font-medium text-black shadow-sm transition-all hover:bg-gray-100 dark:border-strokedark dark:bg-meta-4 dark:text-white dark:hover:bg-opacity-90"
          >
            Annulla
          </button>
          <button
            type="submit"
            form="operatorForm"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-6 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Salvataggio..." : isEditing ? "Aggiorna Permessi" : "Crea Operatore"}
          </button>
        </div>

      </div>
    </div>
  );
}