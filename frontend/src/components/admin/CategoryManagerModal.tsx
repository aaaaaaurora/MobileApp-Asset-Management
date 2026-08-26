import { useState, useEffect } from "react";
import { Category, CategoryAttribute } from "../../pages/Admin/CategoriesManagement";
import { useAuth } from "../../context/AuthContext";
import AttributeFormModal from "./AttributeFormModal";
import ConfirmAlertModal from "./ConfirmAlertModal";

interface Props {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function CategoryManagerModal({ isOpen, category, onClose, onRefresh }: Props) {
  const { token } = useAuth();
  const baseUrl = import.meta.env.VITE_API_URL || '';
  
  // STATI LAYOUT E DATI BASE
  const [activeTab, setActiveTab] = useState<'general' | 'attributes'>('general');
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  // STATI ATTRIBUTI
  const [localAttributes, setLocalAttributes] = useState<CategoryAttribute[]>([]);
  
  // STATI MODALI SECONDARI
  const [attrFormOpen, setAttrFormOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<CategoryAttribute | null>(null);
  
  const [conflictPrompt, setConflictPrompt] = useState<{isOpen: boolean, pendingAttr: CategoryAttribute | null}>({ isOpen: false, pendingAttr: null });
  const [deprecateAlert, setDeprecateAlert] = useState<{isOpen: boolean, attrName: string, attrType: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setActiveTab('general');
      if (category) {
        setCatName(category.name);
        setCatDesc(category.description);
        setLocalAttributes([]);
      } else {
        setCatName("");
        setCatDesc("");
        setLocalAttributes([]);
      }
    }
  }, [isOpen, category]);

  if (!isOpen) return null;

  const currentAttributesList = category ? category.attributes : localAttributes;

  // ==========================================
  // SALVATAGGIO INTERA CATEGORIA (NUOVA)
  // ==========================================
  const handleCreateFullCategory = async () => {
    if (!catName.trim()) {
      setActiveTab('general');
      return setError("Il nome della categoria è obbligatorio.");
    }
    if (localAttributes.length === 0) {
      setActiveTab('attributes');
      return setError("Inserisci almeno un attributo per completare la configurazione.");
    }

    setIsSubmitting(true);
    setError("");

    try {
      const catRes = await fetch(`${baseUrl}/asset/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      const catData = await catRes.json();
      if (!catRes.ok) throw new Error(catData.error || "Errore creazione categoria");

      for (const attr of localAttributes) {
        await fetch(`${baseUrl}/asset/api/categories/${catData.category._id}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(attr),
        });
      }
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // SALVATAGGIO MODIFICHE INFO GENERALI
  // ==========================================
  const handleSaveGeneralEdits = async () => {
    if (!category) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${baseUrl}/asset/api/categories/${category._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore sconosciuto");
      }
      onRefresh();
      setError("Modifiche salvate.");
      setTimeout(() => setError(""), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // SALVATAGGIO ATTRIBUTO
  // ==========================================
  const handleSaveAttribute = async (attrData: CategoryAttribute) => {
    setError("");
    if (!category) {
      // Modalità Locale (Creazione)
      if (localAttributes.some(a => a.name.toLowerCase() === attrData.name.toLowerCase() && (!editingAttr || editingAttr.name !== a.name))) {
        return setError("Attributo già esistente.");
      }
      if (editingAttr) {
        setLocalAttributes(prev => prev.map(a => a.name === editingAttr.name ? attrData : a));
      } else {
        setLocalAttributes([...localAttributes, attrData]);
      }
      setAttrFormOpen(false);
    } else {
      // Modalità API (Modifica)
      setIsSubmitting(true);
      try {
        const isEdit = !!editingAttr;
        const url = isEdit 
          ? `${baseUrl}/asset/api/categories/${category._id}/attributes/${editingAttr.name}`
          : `${baseUrl}/asset/api/categories/${category._id}/attributes`;
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(attrData),
        });
        const data = await res.json();
        if (res.status === 409 && data.error && data.error.includes("incompatibilità")) {
          setConflictPrompt({ isOpen: true, pendingAttr: attrData });
          setAttrFormOpen(false);
          return;
        }
        if (!res.ok) throw new Error(data.error || "Errore nel salvataggio");
        setAttrFormOpen(false);
        onRefresh();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // ==========================================
  // RISOLUZIONE CONFLITTO (US-2-3 / US-2-4)
  // ==========================================
  const handleResolveConflict = async () => {
    if (!category || !editingAttr || !conflictPrompt.pendingAttr) return;
    setIsSubmitting(true);
    try {
      await fetch(`${baseUrl}/asset/api/categories/${category._id}/attributes/${editingAttr.name}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "unavailable", type: editingAttr.type }),
      });
      const newAttr = { ...conflictPrompt.pendingAttr, name: `${conflictPrompt.pendingAttr.name}_new` };
      await fetch(`${baseUrl}/asset/api/categories/${category._id}/attributes`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newAttr),
      });
      setConflictPrompt({ isOpen: false, pendingAttr: null });
      onRefresh();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // DEPRECAZIONE DIRETTA (US-2-4)
  // ==========================================
  const confirmDeprecate = async () => {
    if (!category || !deprecateAlert) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/asset/api/categories/${category._id}/attributes/${deprecateAlert.attrName}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "unavailable", type: deprecateAlert.attrType }),
      });
      if (!res.ok) throw new Error("Errore durante la deprecazione");
      setDeprecateAlert(null);
      onRefresh();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* SFONDO E CONTENITORE MODALE A DIMENSIONE FISSA */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="w-full max-w-4xl h-[80vh] min-h-[550px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          
          {/* 1. HEADER (Fisso) */}
          <div className="flex-none h-16 px-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              {category ? `Gestione: ${category.name}` : "Configurazione Nuova Categoria"}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* 2. TABS (Fissi) */}
          <div className="flex-none px-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-4 pt-2">
            <button onClick={() => setActiveTab('general')} className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
              Info Generali
            </button>
            <button onClick={() => setActiveTab('attributes')} className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'attributes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
              Attributi e Metadati
              {!category && localAttributes.length > 0 && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{localAttributes.length}</span>}
            </button>
          </div>

          {/* 3. AREA CONTENUTO (Scrollabile Internamente, il modale non si deforma) */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-800">
            {error && (
              <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            {/* TAB INFO GENERALI */}
            {activeTab === 'general' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Nome Categoria</label>
                  <input type="text" value={catName} onChange={e => setCatName(e.target.value)} placeholder="Es. Apparecchiature Elettromedicali" className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm outline-none focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Descrizione (Opzionale)</label>
                  <textarea rows={4} value={catDesc} onChange={e => setCatDesc(e.target.value)} className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm outline-none focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                </div>
                {category && (
                  <div className="flex justify-end pt-2">
                    <button onClick={handleSaveGeneralEdits} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                      Aggiorna Info
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB ATTRIBUTI */}
            {activeTab === 'attributes' && (
              <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-slate-800 dark:text-white">Metadati Configurati</h4>
                  <button onClick={() => { setEditingAttr(null); setAttrFormOpen(true); }} className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
                    + Aggiungi Attributo
                  </button>
                </div>
                
                {currentAttributesList.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500">Nessun attributo configurato.</p>
                    {!category && <p className="text-xs text-rose-500 mt-1">Obbligatorio inserirne almeno uno.</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentAttributesList.map((attr) => (
                      <div key={attr.name} className={`flex items-center justify-between p-3 rounded-lg border ${attr.status === 'unavailable' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200'} dark:bg-slate-800 dark:border-slate-700`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-800 dark:text-white">{attr.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase font-bold">{attr.type}</span>
                            {attr.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 uppercase font-bold">Req</span>}
                            {attr.filterable && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase font-bold">Filtro</span>}
                            {attr.status === 'unavailable' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 border border-slate-300 uppercase font-bold">Deprecato</span>}
                          </div>
                          {attr.type === 'enum' && attr.options.length > 0 && <p className="text-xs text-slate-400 mt-1 truncate">[{attr.options.join(', ')}]</p>}
                        </div>
                        
                        {attr.status === 'active' && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditingAttr(attr); setAttrFormOpen(true); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Modifica</button>
                            {!category ? (
                              <button onClick={() => setLocalAttributes(prev => prev.filter(a => a.name !== attr.name))} className="text-xs font-semibold text-rose-600 hover:text-rose-800">Rimuovi</button>
                            ) : (
                              <button onClick={() => setDeprecateAlert({isOpen: true, attrName: attr.name, attrType: attr.type})} className="text-xs font-semibold text-rose-600 hover:text-rose-800">Depreca</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. FOOTER (Fisso) */}
          <div className="flex-none h-16 px-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end items-center gap-2">
            {!category ? (
               <>
                 <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">Annulla</button>
                 <button onClick={handleCreateFullCategory} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50">
                   {isSubmitting ? "Salvataggio..." : "Salva Nuova Categoria"}
                 </button>
               </>
            ) : (
               <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">Chiudi</button>
            )}
          </div>
        </div>
      </div>

      {/* POPUP SUB-MODALI (Apertura Centrale senza alterare il layout) */}
      <AttributeFormModal 
        isOpen={attrFormOpen} 
        initialData={editingAttr} 
        onClose={() => setAttrFormOpen(false)} 
        onSave={handleSaveAttribute} 
        isSubmitting={isSubmitting}
      />

      <ConfirmAlertModal 
        isOpen={conflictPrompt.isOpen}
        title="Conflitto Dati Storici"
        message={<>Stai modificando il tipo di dato di un attributo, ma esistono già vecchi asset salvati con questo formato.<br/><br/>Vuoi <strong>deprecare</strong> il vecchio attributo (mantenendo lo storico intatto) e generarne automaticamente uno nuovo per il futuro?</>}
        confirmText="Depreca e Genera Nuovo"
        confirmColor="amber"
        onClose={() => setConflictPrompt({isOpen: false, pendingAttr: null})}
        onConfirm={handleResolveConflict}
        isSubmitting={isSubmitting}
      />

      <ConfirmAlertModal 
        isOpen={!!deprecateAlert}
        title="Conferma Deprecazione"
        message={<>Sei sicuro di voler deprecare <strong>{deprecateAlert?.attrName}</strong>?<br/>Non sarà più visibile nei form per i nuovi asset, ma rimarrà intatto per le reportistiche vecchie.</>}
        confirmText="Conferma Deprecazione"
        confirmColor="rose"
        onClose={() => setDeprecateAlert(null)}
        onConfirm={confirmDeprecate}
        isSubmitting={isSubmitting}
      />
    </>
  );
}