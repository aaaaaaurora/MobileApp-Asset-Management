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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            {initialData ? "Modifica Metadato" : "Nuovo Metadato"}
          </h3>
        </div>

        <div className="p-5 overflow-y-auto bg-slate-50 dark:bg-slate-900 flex-1">
          <form id="attrForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Nome</label>
                <input type="text" required value={attrData.name} onChange={e => setAttrData({...attrData, name: e.target.value})} className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Tipo di Dato</label>
                <select value={attrData.type} onChange={e => setAttrData({...attrData, type: e.target.value as any})} className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                  <option value="string">Testo (Stringa)</option>
                  <option value="number">Numero</option>
                  <option value="boolean">Vero/Falso (Boolean)</option>
                  <option value="date">Data</option>
                  <option value="enum">Menu a Tendina (Enum)</option>
                </select>
              </div>
            </div>

            {attrData.type === 'enum' && (
              <div className="p-3 bg-white rounded-md border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Opzioni Tendina</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={optionInput} onChange={e => setOptionInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter'){ e.preventDefault(); addOption(); } }} placeholder="Digita e premi Invio..." className="flex-1 rounded-md border border-slate-300 py-1.5 px-3 text-sm dark:bg-slate-700 dark:text-white" />
                  <button type="button" onClick={addOption} className="px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700">Add</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {attrData.options.map((opt, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                      {opt} <button type="button" onClick={() => setAttrData({...attrData, options: attrData.options.filter((_, idx) => idx !== i)})} className="text-blue-500 hover:text-blue-800 ml-1">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={attrData.required} onChange={e => setAttrData({...attrData, required: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Obbligatorio</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={attrData.filterable} onChange={e => setAttrData({...attrData, filterable: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtro Ricerca</span>
              </label>
            </div>
          </form>
        </div>

        <div className="px-5 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">Annulla</button>
          <button type="submit" form="attrForm" disabled={isSubmitting || (attrData.type === 'enum' && attrData.options.length === 0)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
            {isSubmitting ? "Salvataggio..." : "Conferma"}
          </button>
        </div>

      </div>
    </div>
  );
}