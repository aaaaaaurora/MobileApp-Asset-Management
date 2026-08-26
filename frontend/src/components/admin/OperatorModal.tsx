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
  
  // Stato locale del form per gestire i cambiamenti in tempo reale
  const [formData, setFormData] = useState<OperatorFormData>(initialData);

  // Sincronizza lo stato quando si apre/chiude il modale o cambiano i dati iniziali
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
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-default dark:bg-boxdark sm:p-8">
        <h3 className="mb-5 text-xl font-bold text-black dark:text-white border-b border-stroke pb-3 dark:border-strokedark">
          {isEditing ? "Modifica Permessi Operatore" : "Registrazione Nuovo Operatore"}
        </h3>

        <form onSubmit={handleFormSubmit}>
          {/* Box Errori */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2.5 block font-medium text-black dark:text-white">
              Indirizzo Email (Account Gmail)
            </label>
            <input
              type="email"
              required
              disabled={isEditing}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="es. operatore@gmail.com"
              className="w-full rounded-lg border border-stroke bg-transparent py-3 px-4 outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-70 dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary dark:disabled:bg-meta-4"
            />
            {!isEditing && (
              <p className="mt-1 text-xs text-gray-500">
                L'utente userà questa mail per effettuare il login tramite Google SSO.
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-2.5 block font-medium text-black dark:text-white">
              Categoria di Competenza
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full rounded-lg border border-stroke bg-transparent py-3 px-4 outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            >
              <option value="">-- Nessuna categoria specifica --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="mb-2.5 block font-medium text-black dark:text-white">
              Giurisdizione Territoriale (Campus)
            </label>
            <p className="mb-3 text-xs text-gray-500">
              Seleziona i campus visibili. Se lasci tutto vuoto, l'Operatore non vedrà alcun asset (Zero-Campus).
            </p>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto rounded-lg border border-stroke p-3 dark:border-form-strokedark bg-gray-2 dark:bg-meta-4/30">
              {campuses.map((campus) => (
                <label key={campus.id} className="flex cursor-pointer items-center gap-3 hover:bg-white dark:hover:bg-boxdark p-2 rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.campus_ids.includes(campus.id)}
                    onChange={() => handleCampusToggle(campus.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-form-strokedark dark:bg-form-input"
                  />
                  <span className="text-sm font-medium text-black dark:text-white">{campus.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-stroke px-6 py-2.5 font-medium text-black hover:bg-gray-100 transition-colors dark:border-strokedark dark:text-white dark:hover:bg-meta-4"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Salvataggio..." : isEditing ? "Aggiorna Permessi" : "Crea Operatore"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}