import { useState, useEffect } from "react";
import { CategoryAttribute } from "../../pages/Admin/CategoriesManagement";

interface Props {
  isOpen: boolean;
  initialData: CategoryAttribute | null;
  onClose: () => void;
  onSave: (attr: CategoryAttribute) => void;
  isSubmitting?: boolean;
}

export default function AttributeFormModal({ isOpen, initialData, onClose, onSave, isSubmitting }: Props) {
  const defaultAttr: CategoryAttribute = { name: "", type: "string", required: false, filterable: true, editable: true, visible: true, options: [], status: "active" };
  const [attrData, setAttrData] = useState<CategoryAttribute>(defaultAttr);
  const [optionInput, setOptionInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAttrData(initialData || defaultAttr);
      setOptionInput("");
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(attrData);
  };

  const addOption = () => {
    if (optionInput.trim()) {
      setAttrData({ ...attrData, options: [...attrData.options, optionInput.trim()] });
      setOptionInput("");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
      {/* ALTEZZA FISSA (min-h-[480px]) per evitare l'effetto fisarmonica */}
      <div className="w-full max-w-lg min-h-[480px] max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">
            {initialData ? "Modifica Metadato" : "Nuovo Metadato"}
          </h3>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 flex-1">
          <form id="attrForm" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Nome</label>
                <input type="text" required value={attrData.name} onChange={e => setAttrData({...attrData, name: e.target.value})} className="w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white transition-colors" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Tipo di Dato</label>
                <select value={attrData.type} onChange={e => setAttrData({...attrData, type: e.target.value as any})} className="w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white transition-colors">
                  <option value="string">Testo (Stringa)</option>
                  <option value="number">Numero</option>
                  <option value="boolean">Vero/Falso (Boolean)</option>
                  <option value="date">Data</option>
                  <option value="enum">Menu a Tendina (Enum)</option>
                </select>
              </div>
            </div>

            {/* SEZIONE ENUM (TENDINA) */}
            {attrData.type === 'enum' && (
              <div className="p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-sm animate-fade-in-up">
                <label className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Opzioni Tendina</label>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={optionInput} onChange={e => setOptionInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter'){ e.preventDefault(); addOption(); } }} placeholder="Digita e premi Invio..." className="flex-1 rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-500 outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white transition-colors" />
                  <button type="button" onClick={addOption} className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors">Aggiungi</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {attrData.options.map((opt, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md border border-blue-200">
                      {opt} 
                      <button type="button" onClick={() => setAttrData({...attrData, options: attrData.options.filter((_, idx) => idx !== i)})} className="text-blue-500 hover:text-blue-800">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 pt-3">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={attrData.required} onChange={e => setAttrData({...attrData, required: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 dark:text-slate-300 transition-colors">Campo Obbligatorio</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={attrData.filterable} onChange={e => setAttrData({...attrData, filterable: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 dark:text-slate-300 transition-colors">Filtro Ricerca</span>
              </label>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">Annulla</button>
          <button type="submit" form="attrForm" disabled={isSubmitting || (attrData.type === 'enum' && attrData.options.length === 0)} className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
            {isSubmitting ? "Attendere..." : "Conferma"}
          </button>
        </div>

      </div>
    </div>
  );
}