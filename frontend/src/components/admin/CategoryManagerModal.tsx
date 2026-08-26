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
  
  // STATI DATI E LAYOUT
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [creationStep, setCreationStep] = useState<1 | 2>(1); // WIZARD CREAZIONE
  const [activeTab, setActiveTab] = useState<'general' | 'attributes'>('general'); // TABS MODIFICA
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [localAttributes, setLocalAttributes] = useState<CategoryAttribute[]>([]);
  
  // MODALI SECONDARI
  const [attrFormOpen, setAttrFormOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<CategoryAttribute | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<{isOpen: boolean, pendingAttr: CategoryAttribute | null}>({ isOpen: false, pendingAttr: null });
  const [deprecateAlert, setDeprecateAlert] = useState<{isOpen: boolean, attrName: string, attrType: string} | null>(null);
  const [deleteCategoryAlert, setDeleteCategoryAlert] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setCurrentCategory(category);
      if (category) {
        setCatName(category.name);
        setCatDesc(category.description);
        setActiveTab('general');
      } else {
        setCatName("");
        setCatDesc("");
        setLocalAttributes([]);
        setCreationStep(1); // Ripartiamo dal primo step nel Wizard
      }
    }
  }, [isOpen, category]);

  if (!isOpen) return null;

  // Filtriamo gli attributi deprecati per non inquinare la vista
  const visibleAttributes = (currentCategory ? currentCategory.attributes : localAttributes)
    .filter(attr => attr.status !== 'unavailable');

  // ==========================================
  // SYNC IN TEMPO REALE DOPO AGGIORNAMENTO ATTRIBUTO
  // ==========================================
  const refreshCurrentCategory = async () => {
    if (!currentCategory) return;
    try {
      const res = await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedCat = await res.json();
        setCurrentCategory(updatedCat);
        onRefresh(); // Aggiorna anche la tabella di sfondo
      }
    } catch (e) {
      console.error("Errore refresh locale", e);
    }
  };

  // ==========================================
  // WIZARD CREAZIONE CATEGORIA
  // ==========================================
  const handleNextStep = () => {
    if (!catName.trim()) return setError("Inserisci un nome per la categoria.");
    setError("");
    setCreationStep(2);
  };

  const handleCreateFullCategory = async () => {
    if (localAttributes.length === 0) return setError("Aggiungi almeno un attributo.");
    setIsSubmitting(true);
    setError("");

    try {
      const catRes = await fetch(`${baseUrl}/asset/api/categories`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      const catData = await catRes.json();
      if (!catRes.ok) throw new Error(catData.error || "Errore creazione categoria");

      for (const attr of localAttributes) {
        await fetch(`${baseUrl}/asset/api/categories/${catData.category._id}/attributes`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
  // MODIFICHE CATEGORIA ESISTENTE
  // ==========================================
  const handleSaveGeneralEdits = async () => {
    if (!currentCategory) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Errore");
      onRefresh();
      setError("Info aggiornate con successo!");
      setTimeout(() => setError(""), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!currentCategory) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.json()).error || "Errore eliminazione");
      setDeleteCategoryAlert(false);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // SALVATAGGIO / MODIFICA ATTRIBUTO
  // ==========================================
  const handleSaveAttribute = async (attrData: CategoryAttribute) => {
    setError("");
    if (!currentCategory) {
      // WIZARD
      if (localAttributes.some(a => a.name.toLowerCase() === attrData.name.toLowerCase() && (!editingAttr || editingAttr.name !== a.name))) {
        return setError("Un attributo con questo nome esiste già.");
      }
      setLocalAttributes(editingAttr 
        ? localAttributes.map(a => a.name === editingAttr.name ? attrData : a) 
        : [...localAttributes, attrData]);
      setAttrFormOpen(false);
    } else {
      // EDIT DB
      setIsSubmitting(true);
      try {
        const isEdit = !!editingAttr;
        const url = isEdit ? `${baseUrl}/asset/api/categories/${currentCategory._id}/attributes/${editingAttr.name}` : `${baseUrl}/asset/api/categories/${currentCategory._id}/attributes`;
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(attrData),
        });
        const data = await res.json();
        
        if (res.status === 409 && data.error && data.error.includes("incompatibilità")) {
          setConflictPrompt({ isOpen: true, pendingAttr: attrData });
          setAttrFormOpen(false);
          return;
        }
        if (!res.ok) throw new Error(data.error || "Errore nel salvataggio");
        
        setAttrFormOpen(false);
        await refreshCurrentCategory(); // Aggiornamento UI immediato
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleResolveConflict = async () => {
    if (!currentCategory || !editingAttr || !conflictPrompt.pendingAttr) return;
    setIsSubmitting(true);
    try {
      await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}/attributes/${editingAttr.name}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "unavailable", type: editingAttr.type }),
      });
      const newAttr = { ...conflictPrompt.pendingAttr, name: `${conflictPrompt.pendingAttr.name}_new` };
      await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}/attributes`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newAttr),
      });
      
      setConflictPrompt({ isOpen: false, pendingAttr: null });
      await refreshCurrentCategory();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeprecate = async () => {
    if (!currentCategory || !deprecateAlert) return;
    setIsSubmitting(true);
    try {
      await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}/attributes/${deprecateAlert.attrName}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "unavailable", type: deprecateAlert.attrType }),
      });
      setDeprecateAlert(null);
      await refreshCurrentCategory();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
        <div className="w-full max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          
          {/* HEADER */}
          <div className="flex-none h-16 px-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              {currentCategory ? `Gestione Categoria: ${currentCategory.name}` : "Nuova Categoria"}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* NAVIGAZIONE (WIZARD O TABS) */}
          <div className="flex-none px-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-6 pt-2">
            {!currentCategory ? (
              // STEP WIZARD
              <>
                <div className={`pb-3 border-b-2 text-sm font-bold transition-colors ${creationStep === 1 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>1. Informazioni Base</div>
                <div className={`pb-3 border-b-2 text-sm font-bold transition-colors ${creationStep === 2 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>2. Configura Attributi</div>
              </>
            ) : (
              // TABS EDITING
              <>
                <button onClick={() => setActiveTab('general')} className={`pb-3 border-b-2 text-sm font-bold transition-colors ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Info Generali</button>
                <button onClick={() => setActiveTab('attributes')} className={`pb-3 border-b-2 text-sm font-bold transition-colors ${activeTab === 'attributes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Metadati</button>
              </>
            )}
          </div>

          {/* CORPO SCROLLABILE */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-800">
            {error && (
              <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}

            {/* VISTA 1: INFORMAZIONI */}
            {(!currentCategory && creationStep === 1) || (currentCategory && activeTab === 'general') ? (
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Nome Categoria</label>
                  <input type="text" value={catName} onChange={e => setCatName(e.target.value)} placeholder="Es. Macchinari Pesanti" className="w-full rounded-lg border border-slate-300 py-2.5 px-4 text-sm outline-none focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Descrizione</label>
                  <textarea rows={4} value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Dettagli..." className="w-full rounded-lg border border-slate-300 py-2.5 px-4 text-sm outline-none focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                </div>
              </div>
            ) : null}

            {/* VISTA 2: ATTRIBUTI */}
            {(!currentCategory && creationStep === 2) || (currentCategory && activeTab === 'attributes') ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800 dark:text-white">Lista Metadati</h4>
                  <button onClick={() => { setEditingAttr(null); setAttrFormOpen(true); }} className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    + Aggiungi Attributo
                  </button>
                </div>
                
                {visibleAttributes.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-500">Nessun attributo configurato.</p>
                    {!currentCategory && <p className="text-xs text-rose-500 font-bold mt-1">Aggiungine almeno uno per proseguire.</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleAttributes.map((attr) => (
                      <div key={attr.name} className="flex items-center justify-between p-3.5 rounded-lg border bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-600 shadow-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-800 dark:text-white">{attr.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase font-bold">{attr.type}</span>
                            {attr.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 uppercase font-bold">Obbligatorio</span>}
                          </div>
                          {attr.type === 'enum' && <p className="text-xs text-slate-400 mt-1 truncate max-w-md">[{attr.options.join(', ')}]</p>}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditingAttr(attr); setAttrFormOpen(true); }} className="text-xs font-bold text-blue-600 hover:text-blue-800">Modifica</button>
                          {!currentCategory ? (
                            <button onClick={() => setLocalAttributes(prev => prev.filter(a => a.name !== attr.name))} className="text-xs font-bold text-rose-600 hover:text-rose-800">Rimuovi</button>
                          ) : (
                            <button onClick={() => setDeprecateAlert({isOpen: true, attrName: attr.name, attrType: attr.type})} className="text-xs font-bold text-rose-600 hover:text-rose-800">Depreca</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* FOOTER */}
          <div className="flex-none h-16 px-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
            
            {/* LATO SINISTRO (Pulsante Elimina o Indietro) */}
            <div>
              {!currentCategory && creationStep === 2 ? (
                <button onClick={() => setCreationStep(1)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                  ⬅ Indietro
                </button>
              ) : currentCategory ? (
                <button onClick={() => setDeleteCategoryAlert(true)} className="px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Elimina Categoria
                </button>
              ) : <div/>}
            </div>

            {/* LATO DESTRO (Azioni Principali) */}
            <div className="flex gap-3">
              {!currentCategory ? (
                 creationStep === 1 ? (
                   <button onClick={handleNextStep} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
                     Avanti ➔
                   </button>
                 ) : (
                   <button onClick={handleCreateFullCategory} disabled={isSubmitting || localAttributes.length === 0} className="px-6 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors">
                     {isSubmitting ? "Salvataggio..." : "Salva Categoria"}
                   </button>
                 )
              ) : (
                 <>
                   <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Chiudi</button>
                   {activeTab === 'general' && (
                     <button onClick={handleSaveGeneralEdits} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                       Aggiorna Info
                     </button>
                   )}
                 </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* POPUP SUB-MODALI */}
      <AttributeFormModal isOpen={attrFormOpen} initialData={editingAttr} onClose={() => setAttrFormOpen(false)} onSave={handleSaveAttribute} isSubmitting={isSubmitting} />

      <ConfirmAlertModal 
        isOpen={conflictPrompt.isOpen} title="Conflitto Dati Storici" confirmText="Depreca e Genera Nuovo" confirmColor="amber" onClose={() => setConflictPrompt({isOpen: false, pendingAttr: null})} onConfirm={handleResolveConflict} isSubmitting={isSubmitting}
        message={<>Esistono già vecchi asset salvati con questo formato.<br/><br/>Vuoi <strong>deprecare</strong> il vecchio attributo (mantenendo lo storico intatto) e generarne automaticamente uno nuovo?</>}
      />

      <ConfirmAlertModal 
        isOpen={!!deprecateAlert} title="Conferma Deprecazione" confirmText="Depreca Attributo" confirmColor="rose" onClose={() => setDeprecateAlert(null)} onConfirm={confirmDeprecate} isSubmitting={isSubmitting}
        message={<>Sei sicuro di voler deprecare l'attributo?<br/>Non sarà più visibile nei form per i nuovi asset, ma rimarrà intatto per le reportistiche vecchie.</>}
      />

      <ConfirmAlertModal 
        isOpen={deleteCategoryAlert} title="Elimina Categoria" confirmText="Sì, Elimina Definitivamente" confirmColor="rose" onClose={() => setDeleteCategoryAlert(false)} onConfirm={handleDeleteCategory} isSubmitting={isSubmitting}
        message={<>Sei sicuro di voler eliminare l'intera categoria <strong>{currentCategory?.name}</strong> e tutti i suoi metadati?<br/><br/><em>Questa operazione è irreversibile.</em></>}
      />
    </>
  );
}