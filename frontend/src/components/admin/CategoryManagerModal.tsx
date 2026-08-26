import { useState, useEffect } from "react";
import { Category, CategoryAttribute } from "../../pages/Admin/CategoriesManagement";
import { useAuth } from "../../context/AuthContext";

interface Props {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function CategoryManagerModal({ isOpen, category, onClose, onRefresh }: Props) {
  const { token } = useAuth();
  
  // STATI GENERALI
  const [activeTab, setActiveTab] = useState<'general' | 'attributes'>('general');
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // STATI FORM GENERALE
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  // STATI GESTIONE ATTRIBUTI
  const [isAttrFormOpen, setIsAttrFormOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<CategoryAttribute | null>(null);
  
  // Dati del singolo attributo nel form
  const defaultAttr: CategoryAttribute = { name: "", type: "string", required: false, filterable: true, editable: true, visible: true, options: [], status: "active" };
  const [attrData, setAttrData] = useState<CategoryAttribute>(defaultAttr);
  const [enumOptionInput, setEnumOptionInput] = useState("");

  // STATO PER LA RISOLUZIONE CONFLITTI TIPO (US-2-3 / US-2-4)
  const [conflictPrompt, setConflictPrompt] = useState<{isOpen: boolean, pendingAttr: CategoryAttribute | null}>({ isOpen: false, pendingAttr: null });

  useEffect(() => {
    if (isOpen) {
      setError("");
      setConflictPrompt({ isOpen: false, pendingAttr: null });
      if (category) {
        setCatName(category.name);
        setCatDesc(category.description);
        setActiveTab('general');
        setIsAttrFormOpen(false);
      } else {
        setCatName("");
        setCatDesc("");
        setActiveTab('general');
      }
    }
  }, [isOpen, category]);

  if (!isOpen) return null;

  const baseUrl = import.meta.env.VITE_API_URL || '';

  // ==========================================
  // SALVATAGGIO CATEGORIA (CREAZIONE O MODIFICA INFO BASE)
  // ==========================================
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const url = category 
        ? `${baseUrl}/asset/api/categories/${category._id}` 
        : `${baseUrl}/asset/api/categories`;
      const method = category ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore sconosciuto");

      onRefresh();
      if (!category) onClose(); // Chiudi solo se stavo creando una categoria da zero
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // SALVATAGGIO ATTRIBUTO
  // ==========================================
  const handleSaveAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    setIsSubmitting(true);
    setError("");

    try {
      const isEdit = !!editingAttr;
      const url = isEdit 
        ? `${baseUrl}/asset/api/categories/${category._id}/attributes/${editingAttr.name}`
        : `${baseUrl}/asset/api/categories/${category._id}/attributes`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(attrData),
      });

      const data = await res.json();

      // GESTIONE CONFLITTO TIPI (US-2-3)
      if (res.status === 409 && data.error && data.error.includes("incompatibilità")) {
        setConflictPrompt({ isOpen: true, pendingAttr: attrData });
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || "Errore nel salvataggio dell'attributo");

      setIsAttrFormOpen(false);
      onRefresh();
      // Chiudiamo il modale per ricaricare i dati puliti (oppure potremmo gestire lo state localmente per non chiudere)
      onClose(); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // RISOLUZIONE CONFLITTO: DEPRECA E CREA (US-2-4)
  // ==========================================
  const handleResolveConflict = async () => {
    if (!category || !editingAttr || !conflictPrompt.pendingAttr) return;
    setIsSubmitting(true);
    setError("");
    
    try {
      // 1. Deprechiamo il vecchio attributo
      await fetch(`${baseUrl}/asset/api/categories/${category._id}/attributes/${editingAttr.name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "unavailable", type: editingAttr.type }),
      });

      // 2. Creiamo il nuovo attributo con il nuovo tipo (Aggiungendo un suffisso per non andare in collusione di nome)
      const newAttr = { ...conflictPrompt.pendingAttr, name: `${conflictPrompt.pendingAttr.name}_new` };
      const res = await fetch(`${baseUrl}/asset/api/categories/${category._id}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newAttr),
      });
      
      if (!res.ok) throw new Error("Errore durante la creazione del nuovo attributo deprecato.");

      setConflictPrompt({ isOpen: false, pendingAttr: null });
      setIsAttrFormOpen(false);
      onRefresh();
      onClose();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // DEPRECAZIONE DIRETTA (US-2-4)
  // ==========================================
  const handleDeprecateAttribute = async (attrName: string, attrType: string) => {
    if(!category || !confirm(`Sei sicuro di voler deprecare "${attrName}"? Non sarà più utilizzabile per i nuovi inserimenti.`)) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/asset/api/categories/${category._id}/attributes/${attrName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "unavailable", type: attrType }),
      });
      if (!res.ok) throw new Error("Errore durante la deprecazione");
      onRefresh();
      onClose();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-4xl flex flex-col max-h-[95vh] rounded-2xl bg-white shadow-2xl overflow-hidden dark:bg-slate-800">
        
        {/* HEADER */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center dark:bg-slate-900 dark:border-slate-700">
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">
            {category ? `Gestione Categoria: ${category.name}` : "Crea Nuova Categoria"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* NAVIGAZIONE TABS (Mostrato solo se la categoria esiste già) */}
        {category && (
          <div className="flex border-b border-slate-200 px-6 dark:border-slate-700 bg-white dark:bg-slate-800">
            <button 
              onClick={() => {setActiveTab('general'); setIsAttrFormOpen(false);}}
              className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
            >
              Info Generali
            </button>
            <button 
              onClick={() => setActiveTab('attributes')}
              className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'attributes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
            >
              Attributi e Metadati
            </button>
          </div>
        )}

        <div className="overflow-y-auto p-6 flex-1 bg-white dark:bg-slate-800">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 1: INFORMAZIONI GENERALI */}
          {/* ==================================================== */}
          {activeTab === 'general' && (
            <form id="generalForm" onSubmit={handleSaveGeneral} className="max-w-2xl mx-auto space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Nome Categoria</label>
                <input
                  type="text" required value={catName} onChange={(e) => setCatName(e.target.value)}
                  placeholder="Es. Apparecchiature Elettromedicali"
                  className="w-full rounded-lg border border-slate-300 py-3 px-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Descrizione Opzionale</label>
                <textarea
                  rows={3} value={catDesc} onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Fornisci dettagli aggiuntivi..."
                  className="w-full rounded-lg border border-slate-300 py-3 px-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors">Annulla</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-lg bg-blue-600 font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {isSubmitting ? "Salvataggio..." : "Salva Informazioni"}
                </button>
              </div>
            </form>
          )}

          {/* ==================================================== */}
          {/* TAB 2: ATTRIBUTI DINAMICI */}
          {/* ==================================================== */}
          {activeTab === 'attributes' && category && (
            <div>
              {!isAttrFormOpen ? (
                // LISTA ATTRIBUTI
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-lg text-slate-800 dark:text-white">Metadati Configurati</h4>
                    <button 
                      onClick={() => {setAttrData(defaultAttr); setEditingAttr(null); setIsAttrFormOpen(true);}}
                      className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 transition-colors"
                    >
                      + Aggiungi Attributo
                    </button>
                  </div>
                  
                  {category.attributes?.length === 0 ? (
                    <p className="text-slate-500 italic text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">Nessun attributo configurato.</p>
                  ) : (
                    <div className="grid gap-3">
                      {category.attributes.map((attr) => (
                        <div key={attr.name} className={`flex items-center justify-between p-4 rounded-xl border ${attr.status === 'unavailable' ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm'} dark:bg-slate-700 dark:border-slate-600`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 dark:text-white">{attr.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono font-semibold">{attr.type}</span>
                              {attr.required && <span className="text-xs px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-semibold">Obbligatorio</span>}
                              {attr.filterable && <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold">Filtro</span>}
                              {attr.status === 'unavailable' && <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-semibold">Deprecato</span>}
                            </div>
                            {attr.type === 'enum' && attr.options.length > 0 && (
                              <p className="text-xs text-slate-500 mt-1 truncate max-w-xl">Opzioni: {attr.options.join(', ')}</p>
                            )}
                          </div>
                          
                          {attr.status === 'active' && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => {setAttrData(attr); setEditingAttr(attr); setIsAttrFormOpen(true);}} className="text-sm font-semibold text-blue-600 hover:underline">Modifica</button>
                              <span className="text-slate-300">|</span>
                              <button onClick={() => handleDeprecateAttribute(attr.name, attr.type)} className="text-sm font-semibold text-rose-600 hover:underline">Depreca</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // FORM CREAZIONE/MODIFICA ATTRIBUTO (US-2-1, US-2-2)
                <div className="max-w-2xl mx-auto bg-slate-50 p-6 rounded-xl border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                  <h4 className="font-bold text-lg text-slate-800 mb-4 dark:text-white">
                    {editingAttr ? `Modifica Attributo: ${editingAttr.name}` : "Nuovo Attributo"}
                  </h4>
                  
                  {conflictPrompt.isOpen ? (
                    // PROMPT DI CONFLITTO E DEPRECAZIONE (US-2-3 / US-2-4)
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-lg">
                      <h3 className="text-amber-800 font-bold text-lg mb-2">Conflitto di Dati Storici Rilevato</h3>
                      <p className="text-amber-700 text-sm mb-4">
                        Stai tentando di cambiare il tipo di dato di questo attributo, ma esistono già degli asset salvati con il vecchio tipo. 
                        Modificarlo forzatamente corromperebbe lo storico.
                      </p>
                      <p className="text-amber-700 text-sm font-bold mb-4">
                        Vuoi deprecare il vecchio attributo (rendendolo "Unavailable" per il futuro ma visibile nello storico) e creare un nuovo attributo pulito?
                      </p>
                      <div className="flex gap-3 mt-4">
                        <button onClick={() => setConflictPrompt({isOpen: false, pendingAttr: null})} className="px-4 py-2 bg-white text-amber-700 border border-amber-300 rounded font-bold hover:bg-amber-100">Annulla</button>
                        <button onClick={handleResolveConflict} disabled={isSubmitting} className="px-4 py-2 bg-amber-600 text-white rounded font-bold hover:bg-amber-700">Sì, Depreca e Procedi</button>
                      </div>
                    </div>
                  ) : (
                    // NORMALE FORM ATTRIBUTO
                    <form onSubmit={handleSaveAttribute} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Nome Metadato</label>
                          <input type="text" required value={attrData.name} onChange={e => setAttrData({...attrData, name: e.target.value})} className="w-full rounded-lg border border-slate-300 py-2.5 px-3 outline-none focus:border-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">Tipo di Dato</label>
                          <select value={attrData.type} onChange={e => setAttrData({...attrData, type: e.target.value as any})} className="w-full rounded-lg border border-slate-300 py-2.5 px-3 outline-none focus:border-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                            <option value="string">Testo (Stringa)</option>
                            <option value="number">Numero</option>
                            <option value="boolean">Vero/Falso (Boolean)</option>
                            <option value="date">Data</option>
                            <option value="enum">Menu a Tendina (Enum)</option>
                          </select>
                        </div>
                      </div>

                      {/* Gestione Opzioni Enum Dinamiche (US-2-2) */}
                      {attrData.type === 'enum' && (
                        <div className="p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-600">
                          <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Opzioni Selezionabili</label>
                          <div className="flex gap-2 mb-3">
                            <input type="text" value={enumOptionInput} onChange={e => setEnumOptionInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); if(enumOptionInput.trim()) { setAttrData({...attrData, options: [...attrData.options, enumOptionInput.trim()]}); setEnumOptionInput(""); } } }} placeholder="Digita opzione e premi Invio..." className="flex-1 rounded-lg border border-slate-300 py-2 px-3 text-sm dark:bg-slate-700 dark:text-white" />
                            <button type="button" onClick={() => { if(enumOptionInput.trim()){ setAttrData({...attrData, options: [...attrData.options, enumOptionInput.trim()]}); setEnumOptionInput(""); } }} className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900">Aggiungi</button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {attrData.options.map((opt, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                {opt}
                                <button type="button" onClick={() => setAttrData({...attrData, options: attrData.options.filter((_, idx) => idx !== i)})} className="text-blue-500 hover:text-blue-900 ml-1">×</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-6 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={attrData.required} onChange={e => setAttrData({...attrData, required: e.target.checked})} className="h-5 w-5 rounded border-slate-300 text-blue-600" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Obbligatorio</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={attrData.filterable} onChange={e => setAttrData({...attrData, filterable: e.target.checked})} className="h-5 w-5 rounded border-slate-300 text-blue-600" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Filtro di Ricerca (US-2-3)</span>
                        </label>
                      </div>

                      <div className="pt-5 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-600 mt-5">
                        <button type="button" onClick={() => setIsAttrFormOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition-colors">Annulla</button>
                        <button type="submit" disabled={isSubmitting || (attrData.type === 'enum' && attrData.options.length === 0)} className="px-6 py-2.5 rounded-lg bg-blue-600 font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {isSubmitting ? "Salvataggio..." : "Salva Attributo"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}