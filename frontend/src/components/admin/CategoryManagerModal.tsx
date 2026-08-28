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
  
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [creationStep, setCreationStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState<'general' | 'attributes'>('general');
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  
  // Utilizzato sia per creare da zero, sia come "Standby" per le modifiche in edit
  const [localAttributes, setLocalAttributes] = useState<CategoryAttribute[]>([]);
  
  const [attrFormOpen, setAttrFormOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<CategoryAttribute | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<{isOpen: boolean, pendingAttr: CategoryAttribute | null, oldName?: string}>({ isOpen: false, pendingAttr: null });
  const [deprecateAlert, setDeprecateAlert] = useState<{isOpen: boolean, attrName: string, attrType: string} | null>(null);
  const [deleteCategoryAlert, setDeleteCategoryAlert] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setCurrentCategory(category);
      if (category) {
        setCatName(category.name || "");
        setCatDesc(category.description || "");
        // In edit, carichiamo gli attributi in memoria aggiungendo un tag per ricordare il nome originale
        setLocalAttributes(category.attributes.map(a => ({ ...a, _originalName: a.name })));
        setActiveTab('general');
      } else {
        setCatName("");
        setCatDesc("");
        setLocalAttributes([]);
        setCreationStep(1);
      }
    }
  }, [isOpen, category]);

  if (!isOpen) return null;

  // Renderizziamo sempre gli attributi "in standby" nascondendo quelli deprecati
  const visibleAttributes = localAttributes.filter(attr => attr.status !== 'unavailable');

  // ==========================================
  // CONTROLLO MODIFICHE IN STANDBY PER ABILITARE IL TASTO
  // ==========================================
  const safeOriginalName = currentCategory?.name || "";
  const safeOriginalDesc = currentCategory?.description || "";
  
  const cleanAttr = (attr: any) => {
    const { _originalName, ...rest } = attr;
    return rest;
  };

  const hasGeneralChanges = currentCategory && (catName !== safeOriginalName || catDesc !== safeOriginalDesc);
  const hasAttributeChanges = currentCategory && (
    JSON.stringify(localAttributes.map(cleanAttr)) !== JSON.stringify(currentCategory.attributes)
  );
  const hasChanges = hasGeneralChanges || hasAttributeChanges;

  const refreshCurrentCategory = async () => {
    if (!currentCategory) return;
    try {
      const res = await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const updatedCat = await res.json();
        setCurrentCategory(updatedCat);
        setLocalAttributes(updatedCat.attributes.map((a: any) => ({ ...a, _originalName: a.name })));
        onRefresh();
      }
    } catch (e) { console.error(e); }
  };

  // ==========================================
  // SALVATAGGIO CREAZIONE CATEGORIA
  // ==========================================
  const handleCreateFullCategory = async () => {
    if (localAttributes.length === 0) return setError("Aggiungi almeno un attributo.");
    setIsSubmitting(true); setError("");

    try {
      const catRes = await fetch(`${baseUrl}/asset/api/categories`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      const catData = await catRes.json();
      if (!catRes.ok) throw new Error(catData.error || "Errore creazione categoria");

      const newCatId = catData.category._id;
      for (const attr of localAttributes) {
        const attrRes = await fetch(`${baseUrl}/asset/api/categories/${newCatId}/attributes`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(cleanAttr(attr)),
        });
        if (!attrRes.ok) throw new Error((await attrRes.json()).error || `Errore salvataggio ${attr.name}`);
      }
      onRefresh(); onClose();
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  // ==========================================
  // SALVATAGGIO IN MASSA DI TUTTE LE MODIFICHE (Il Nuovo "Aggiorna Info")
  // ==========================================
  const handleSaveGeneralEdits = async () => {
    if (!currentCategory || !hasChanges) return;
    setIsSubmitting(true); setError("");
    
    try {
      // 1. Salva Info Generali se modificate
      if (hasGeneralChanges) {
        const res = await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}`, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: catName, description: catDesc }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Errore aggiornamento info generali");
      }

      // 2. Salva le modifiche agli Attributi
      if (hasAttributeChanges) {
        for (const attr of localAttributes) {
          const isNew = !(attr as any)._originalName;
          const originalAttr = currentCategory.attributes.find(a => a.name === (attr as any)._originalName);
          const cleanAttrData = cleanAttr(attr);

          if (isNew) {
            // Nuovissimo attributo
            const res = await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}/attributes`, {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify(cleanAttrData),
            });
            if (!res.ok) throw new Error((await res.json()).error || `Errore salvataggio ${attr.name}`);
          } else if (originalAttr && JSON.stringify(cleanAttrData) !== JSON.stringify(originalAttr)) {
            // Attributo Esistente Modificato
            const res = await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}/attributes/${(attr as any)._originalName}`, {
              method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify(cleanAttrData),
            });
            
            if (res.status === 409) {
              const data = await res.json();
              if (data.error?.includes("incompatibilità")) {
                setConflictPrompt({ isOpen: true, pendingAttr: cleanAttrData, oldName: (attr as any)._originalName });
                setIsSubmitting(false);
                return; // Ferma il salvataggio massivo in attesa di risoluzione utente
              }
            }
            if (!res.ok) throw new Error((await res.json()).error || `Errore aggiornamento ${attr.name}`);
          }
        }
      }
      
      await refreshCurrentCategory();
      setError("Tutte le modifiche sono state salvate!");
      setTimeout(() => setError(""), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // AZIONI IN STANDBY (Modifiche Locali)
  // ==========================================
  const handleSaveAttribute = (attrData: CategoryAttribute) => {
    setError("");
    if (localAttributes.some(a => a.name.toLowerCase() === attrData.name.toLowerCase() && (!editingAttr || editingAttr.name !== a.name))) {
      return setError("Un attributo con questo nome esiste già in memoria.");
    }
    
    // Aggiorna lo stato locale senza chiamare il database
    if (editingAttr) {
      setLocalAttributes(prev => prev.map(a => a.name === editingAttr.name ? { ...attrData, _originalName: (a as any)._originalName } : a));
    } else {
      setLocalAttributes([...localAttributes, attrData]);
    }
    setAttrFormOpen(false);
  };

  const confirmDeprecate = () => {
    if (deprecateAlert) {
      // Imposta su unavailable solo nello stato locale
      setLocalAttributes(prev => prev.map(a => a.name === deprecateAlert.attrName ? { ...a, status: 'unavailable' } : a));
      setDeprecateAlert(null);
    }
  };

  // ==========================================
  // ELIMINAZIONE CATEGORIA E RISOLUZIONE CONFLITTO API
  // ==========================================
  const handleDeleteCategory = async () => {
    if (!currentCategory) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error || "Impossibile eliminare");
      setDeleteCategoryAlert(false); onRefresh(); onClose();
    } catch (err: any) { setError(err.message); setIsSubmitting(false); }
  };

  const handleResolveConflict = async () => {
    if (!currentCategory || !conflictPrompt.pendingAttr) return;
    setIsSubmitting(true);
    try {
      const oldName = conflictPrompt.oldName || conflictPrompt.pendingAttr.name;
      await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}/attributes/${oldName}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "unavailable", type: conflictPrompt.pendingAttr.type }),
      });
      const newAttr = { ...conflictPrompt.pendingAttr, name: `${conflictPrompt.pendingAttr.name}_new` };
      await fetch(`${baseUrl}/asset/api/categories/${currentCategory._id}/attributes`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newAttr),
      });
      
      setConflictPrompt({ isOpen: false, pendingAttr: null });
      await refreshCurrentCategory();
    } catch(err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
        {/* Modale più basso e stretto (max-w-2xl, h-[65vh]) */}
        <div className="w-full max-w-2xl flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={{ height: '65vh', minHeight: '450px' }}>
          
          {/* HEADER FISSO */}
          <div className="flex-none h-16 px-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              {currentCategory ? `Gestione Categoria: ${currentCategory.name}` : "Nuova Categoria"}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* NAVIGAZIONE FISSA */}
          <div className="flex-none px-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-6 pt-2">
            {!currentCategory ? (
              <>
                <div className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${creationStep === 1 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>1. Informazioni Base</div>
                <div className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${creationStep === 2 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>2. Configura Attributi</div>
              </>
            ) : (
              <>
                <button onClick={() => setActiveTab('general')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Info Generali</button>
                <button onClick={() => setActiveTab('attributes')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${activeTab === 'attributes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Metadati</button>
              </>
            )}
          </div>

          {/* AREA SCROLLABILE (Contenuto Interno) */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-800">
            {error && (
              <div className="mb-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            {/* TAB INFORMAZIONI */}
            {(!currentCategory && creationStep === 1) || (currentCategory && activeTab === 'general') ? (
              <div className="max-w-xl mx-auto space-y-5 mt-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Nome Categoria</label>
                  <input type="text" value={catName} onChange={e => setCatName(e.target.value)} placeholder="Es. Macchinari" className="w-full rounded-md border border-slate-300 py-2.5 px-3 text-sm outline-none focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Descrizione</label>
                  <textarea rows={4} value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Dettagli..." className="w-full rounded-md border border-slate-300 py-2.5 px-3 text-sm outline-none focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                </div>
              </div>
            ) : null}

            {/* TAB ATTRIBUTI */}
            {(!currentCategory && creationStep === 2) || (currentCategory && activeTab === 'attributes') ? (
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-slate-800 dark:text-white">Lista Metadati</h4>
                  <button onClick={() => { setEditingAttr(null); setAttrFormOpen(true); }} className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
                    + Aggiungi Attributo
                  </button>
                </div>
                
                {visibleAttributes.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500">Nessun metadato disponibile.</p>
                    {!currentCategory && <p className="text-xs text-rose-500 font-semibold mt-1">Aggiungine almeno uno per completare la configurazione.</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleAttributes.map((attr) => (
                      <div key={attr.name} className="flex items-center justify-between p-3.5 rounded-lg border bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-600 shadow-sm transition-all hover:border-blue-200">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-800 dark:text-white">{attr.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase font-semibold">{attr.type}</span>
                            {attr.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 uppercase font-semibold">Obbligatorio</span>}
                          </div>
                          {attr.type === 'enum' && <p className="text-xs text-slate-400 mt-1 truncate max-w-[200px]">[{attr.options.join(', ')}]</p>}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditingAttr(attr); setAttrFormOpen(true); }} className="text-xs font-bold text-blue-600 hover:text-blue-800">Modifica</button>
                          {/* Se l'attributo non ha un nome originale, significa che è appena stato creato localmente -> Elimina */}
                          {!currentCategory || !(attr as any)._originalName ? (
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

          {/* FOOTER FISSO & UNIFICATO */}
          <div className="flex-none h-16 px-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
            
            {/* LATO SINISTRO */}
            <div>
              {!currentCategory && creationStep === 2 ? (
                <button onClick={() => setCreationStep(1)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">
                  ⬅ Indietro
                </button>
              ) : currentCategory ? (
                <button onClick={() => setDeleteCategoryAlert(true)} className="px-3 py-2 text-sm font-medium text-rose-600 border border-rose-200 bg-white hover:bg-rose-50 rounded-md transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Elimina Categoria
                </button>
              ) : null}
            </div>

            {/* LATO DESTRO */}
            <div className="flex gap-2">
              {!currentCategory ? (
                 creationStep === 1 ? (
                   <>
                     <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Annulla</button>
                     <button onClick={() => { if(!catName.trim()) setError("Nome obbligatorio"); else { setError(""); setCreationStep(2); } }} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-colors">Avanti ➔</button>
                   </>
                 ) : (
                   <button onClick={handleCreateFullCategory} disabled={isSubmitting || localAttributes.length === 0} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors">
                     {isSubmitting ? "Salvataggio in corso..." : "Salva Categoria"}
                   </button>
                 )
              ) : (
                 <>
                   {/* FOOTER UGUALE IN EDITING (Innesca il salvataggio massivo) */}
                   <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Chiudi</button>
                   <button onClick={handleSaveGeneralEdits} disabled={isSubmitting || !hasChanges} className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm transition-colors ${hasChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed dark:bg-slate-600 dark:text-slate-400'}`}>
                     {isSubmitting ? "Attendere..." : "Aggiorna Info"}
                   </button>
                 </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* POPUP SUB-MODALI (Usano onSubmit interno) */}
      <AttributeFormModal isOpen={attrFormOpen} initialData={editingAttr} onClose={() => setAttrFormOpen(false)} onSave={handleSaveAttribute} isSubmitting={false} />
      
      <ConfirmAlertModal isOpen={conflictPrompt.isOpen} title="Conflitto Dati Storici" confirmText="Depreca e Genera Nuovo" confirmColor="amber" onClose={() => setConflictPrompt({isOpen: false, pendingAttr: null})} onConfirm={handleResolveConflict} isSubmitting={isSubmitting} message={<>Esistono già vecchi asset salvati con questo formato.<br/><br/>Vuoi <strong>deprecare</strong> il vecchio attributo (mantenendo lo storico intatto) e generarne automaticamente uno nuovo?</>} />
      
      <ConfirmAlertModal isOpen={!!deprecateAlert} title="Conferma Deprecazione" confirmText="Metti in Standby" confirmColor="rose" onClose={() => setDeprecateAlert(null)} onConfirm={confirmDeprecate} isSubmitting={false} message={<>Sei sicuro di voler deprecare l'attributo?<br/>Cliccando Conferma, la rimozione verrà messa in standby. <strong>Dovrai poi cliccare su "Aggiorna Info"</strong> per rendere la modifica definitiva sul database.</>} />
      
      <ConfirmAlertModal isOpen={deleteCategoryAlert} title="Elimina Categoria" confirmText="Sì, Elimina Definitivamente" confirmColor="rose" onClose={() => setDeleteCategoryAlert(false)} onConfirm={handleDeleteCategory} isSubmitting={isSubmitting} message={<>Sei sicuro di voler eliminare l'intera categoria e tutti i suoi metadati?<br/><br/><em>Questa operazione è irreversibile.</em></>} />
    </>
  );
}