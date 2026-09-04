import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';

interface CategoryAttribute {
  name: string;
  type: string;
  required: boolean;
  filterable: boolean;
  options?: string[];
  status: string; // <-- AGGIUNTO: Necessario per filtrare gli attributi deprecati
}

interface Category {
  _id: string;
  name: string;
  attributes: CategoryAttribute[];
}

interface Campus {
  id: string;
  name: string;
}

interface Asset {
  _id: string;
  category_id: string;
  campus_id: string;
  geometry: { type: string; coordinates: [number, number] };
  metadata: Record<string, any>;
  media_ids?: string[];
  status: string;
  created_at: string;
}

export default function AssetList() {
  const { token, user } = useAuth();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATI PER I FILTRI ---
  const [selectedCampus, setSelectedCampus] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [formData, setFormData] = useState<{ lat: number; lng: number; metadata: Record<string, any>; media_ids: string[] }>({ lat: 0, lng: 0, metadata: {}, media_ids: [] });
  const [isProcessing, setIsProcessing] = useState(false);

  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  const [pendingUploads, setPendingUploads] = useState<{file: File, preview: string}[]>([]);

  // Controllo Ruolo
  const isAdmin = user?.role === 'AMMINISTRATORE';

  useEffect(() => {
    fetchStaticData();
  }, [token]);

  useEffect(() => {
    fetchAssets();
  }, [token, selectedCampus, selectedCategory, dynamicFilters]);

  const fetchStaticData = async () => {
    try {
      const catRes = await fetch(`${import.meta.env.VITE_API_URL}/asset/api/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (catRes.ok) setCategories(await catRes.json());

      const campRes = await fetch(`${import.meta.env.VITE_API_URL}/geozone/api/geozones/campuses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (campRes.ok) setCampuses(await campRes.json());

    } catch (error) {
      console.error("Errore nel recupero dati statici:", error);
    }
  };

  const fetchAssets = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (selectedCampus) params.append('campus_id', selectedCampus);
      if (selectedCategory) params.append('category_id', selectedCategory);
      
      Object.entries(dynamicFilters).forEach(([key, value]) => {
        if (value) params.append(`attr_${key}`, value);
      });

      const url = `${import.meta.env.VITE_API_URL}/asset/api/assets?${params.toString()}`;
      
      const assetRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (assetRes.ok) {
        const assetData = await assetRes.json();
        setAssets(assetData.assets || []);
      }
    } catch (error) {
      console.error("Errore nel recupero asset:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilterChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setDynamicFilters({});
  };

  const handleDynamicFilterChange = (attrName: string, value: string) => {
    setDynamicFilters(prev => ({
      ...prev,
      [attrName]: value
    }));
  };

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c._id === categoryId);
    return cat ? cat.name : categoryId;
  };

  const openEditModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      lng: asset.geometry.coordinates[0],
      lat: asset.geometry.coordinates[1],
      metadata: { ...asset.metadata },
      media_ids: asset.media_ids ? [...asset.media_ids] : []
    });
    setPendingDeletes([]);
    setPendingUploads([]);
  };

  const handleMetadataChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [key]: value }
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUploads(prev => [...prev, { file, preview: URL.createObjectURL(file) }]);
  };

  const handleDeleteExistingImage = (mediaId: string) => {
    setPendingDeletes(prev => [...prev, mediaId]);
    setFormData(prev => ({ ...prev, media_ids: prev.media_ids.filter(id => id !== mediaId) }));
  };

  const handleDeletePendingImage = (index: number) => {
    setPendingUploads(prev => prev.filter((_, i) => i !== index));
  };

  const closeModal = () => {
    setSelectedAsset(null);
    setPendingUploads([]);
    setPendingDeletes([]);
  };

  const handleUpdate = async () => {
    if (!selectedAsset || isAdmin) return;
    setIsProcessing(true);

    try {
      if (pendingDeletes.length > 0) {
        await Promise.all(pendingDeletes.map(mediaId => 
          fetch(`${import.meta.env.VITE_API_URL}/media/images/${mediaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ));
      }

      const newUploadedIds: string[] = [];
      for (const item of pendingUploads) {
        const uploadPayload = new FormData();
        uploadPayload.append('images', item.file);

        const res = await fetch(`${import.meta.env.VITE_API_URL}/media/images/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: uploadPayload
        });

        if (!res.ok) throw new Error("Errore durante l'upload delle nuove immagini");
        const data = await res.json();
        newUploadedIds.push(data.uploaded[0].media_id);
      }

      const finalMediaIds = [...formData.media_ids, ...newUploadedIds];
      const payload = {
        geometry: { type: 'Point', coordinates: [formData.lng, formData.lat] },
        metadata: formData.metadata,
        media_ids: finalMediaIds 
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/asset/api/assets/${selectedAsset._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore durante l'aggiornamento dell'asset");
      }

      alert("Asset aggiornato con successo!");
      closeModal();
      fetchAssets(); 
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;
    if (!window.confirm("Sei sicuro di voler eliminare questo asset? Verrà conservato nello storico ma rimosso dalla mappa.")) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/asset/api/assets/${selectedAsset._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Errore durante l'eliminazione");
      alert("Asset eliminato con successo!");
      closeModal();
      fetchAssets();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeCategory = selectedAsset ? categories.find(c => c._id === selectedAsset.category_id) : null;
  
  // <-- MODIFICA QUI: Aggiunto attr.status !== 'unavailable' per nascondere i filtri deprecati
  const filterableAttributes = selectedCategory 
    ? categories.find(c => c._id === selectedCategory)?.attributes.filter(attr => attr.filterable && attr.status !== 'unavailable') || []
    : [];

  return (
    <>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Lista Assets Censiti
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cerca, filtra e gestisci gli elementi registrati nei campus.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtro Campus</label>
            <select 
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
            >
              <option value="">Tutti i Campus</option>
              {campuses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtro Categoria</label>
            <select 
              value={selectedCategory}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
            >
              <option value="">Tutte le Categorie</option>
              {categories.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedCategory && filterableAttributes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-end gap-3">
            {filterableAttributes.map(attr => (
              <div key={attr.name} className="w-[150px]">
                <label className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400 capitalize tracking-wide truncate">
                  {attr.name.replace('_', ' ')}
                </label>
                
                {attr.type === 'enum' ? (
                  <select 
                    value={dynamicFilters[attr.name] || ''}
                    onChange={(e) => handleDynamicFilterChange(attr.name, e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-transparent px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
                  >
                    <option value="">Tutti</option>
                    {attr.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : attr.type === 'boolean' ? (
                   <select 
                    value={dynamicFilters[attr.name] || ''}
                    onChange={(e) => handleDynamicFilterChange(attr.name, e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-transparent px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
                  >
                    <option value="">Tutti</option>
                    <option value="true">Sì</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input 
                    type={attr.type === 'number' ? 'number' : 'text'}
                    value={dynamicFilters[attr.name] || ''}
                    onChange={(e) => handleDynamicFilterChange(attr.name, e.target.value)}
                    placeholder="Cerca..."
                    className="w-full rounded-md border border-slate-300 bg-transparent px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 dark:bg-slate-700 dark:text-white dark:border-slate-600">
              <tr>
                <th className="py-3 px-6 font-semibold uppercase tracking-wider text-xs">Categoria</th>
                <th className="py-3 px-6 font-semibold uppercase tracking-wider text-xs">ID Seriale</th>
                <th className="py-3 px-6 font-semibold uppercase tracking-wider text-xs">Data Creazione</th>
                <th className="py-3 px-6 font-semibold uppercase tracking-wider text-xs text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <div className="flex justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-blue-600 border-t-transparent"></div></div>
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center font-medium text-slate-500">
                    La ricerca non ha prodotto alcun risultato.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-6 font-bold text-slate-800 dark:text-slate-200 uppercase">
                      {getCategoryName(asset.category_id)}
                    </td>
                    <td className="py-3 px-6 font-mono text-slate-500 dark:text-slate-400 text-xs">
                      {asset._id}
                    </td>
                    <td className="py-3 px-6">
                      {new Date(asset.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button 
                        onClick={() => openEditModal(asset)} 
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {isAdmin ? 'Visualizza' : 'Gestisci'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAsset && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto transform transition-all">
            
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                {isAdmin ? 'Dettagli Asset' : 'Gestione Asset'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors">✕</button>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">
                {isAdmin ? 'Foto dell\'Asset' : 'Gestione Foto'}
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                
                {formData.media_ids.map(mediaId => (
                  <div key={mediaId} className="relative min-w-[120px] h-28 flex-shrink-0 group">
                    <img 
                      src={`${import.meta.env.VITE_API_URL}/media/images/${mediaId}`} 
                      className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                      alt="Asset Media" 
                    />
                    {!isAdmin && (
                      <button 
                        onClick={() => handleDeleteExistingImage(mediaId)} 
                        className="absolute top-1.5 right-1.5 bg-rose-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-md hover:bg-rose-700 transition opacity-0 group-hover:opacity-100"
                        title="Elimina foto"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                
                {!isAdmin && pendingUploads.map((item, index) => (
                  <div key={`new-${index}`} className="relative min-w-[120px] h-28 flex-shrink-0">
                    <img 
                      src={item.preview} 
                      className="w-full h-full object-cover rounded-lg border-2 border-emerald-500 opacity-90"
                      alt="New Upload" 
                    />
                    <button 
                      onClick={() => handleDeletePendingImage(index)} 
                      className="absolute top-1.5 right-1.5 bg-rose-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-md hover:bg-rose-700 transition"
                      title="Annulla inserimento"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {!isAdmin && (
                  <label className="min-w-[120px] h-28 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                    <span className="text-2xl text-slate-400">+</span>
                    <span className="text-[11px] font-medium text-slate-500 mt-1">Carica Foto</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isProcessing} />
                  </label>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Coordinate Geografiche</h4>
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Latitudine</label>
                  <input 
                    type="number" step="any" 
                    value={formData.lat} 
                    disabled={isAdmin}
                    onChange={e => setFormData(p => ({...p, lat: parseFloat(e.target.value)}))} 
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-900" 
                  />
                </div>
                <div className="w-1/2">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Longitudine</label>
                  <input 
                    type="number" step="any" 
                    value={formData.lng} 
                    disabled={isAdmin}
                    onChange={e => setFormData(p => ({...p, lng: parseFloat(e.target.value)}))} 
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-900" 
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Metadati Categoria</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeCategory ? (
                  activeCategory.attributes.filter(attr => attr.status !== 'unavailable').map(attr => (
                    <div key={attr.name}>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400 capitalize">
                        {attr.name.replace('_', ' ')} {attr.required && <span className="text-rose-500">*</span>}
                      </label>
                      
                      {attr.type === 'enum' ? (
                        <select 
                          value={formData.metadata[attr.name] || ''} 
                          disabled={isAdmin}
                          onChange={(e) => handleMetadataChange(attr.name, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                        >
                          <option value="">Seleziona...</option>
                          {attr.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input 
                          type={attr.type === 'number' ? 'number' : 'text'} 
                          value={formData.metadata[attr.name] || ''} 
                          disabled={isAdmin}
                          onChange={e => handleMetadataChange(attr.name, attr.type === 'number' ? parseFloat(e.target.value) : e.target.value)} 
                          className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-900" 
                        />
                      )}
                    </div>
                  ))
                ) : (
                  Object.keys(formData.metadata).map(key => (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400 capitalize">{key.replace('_', ' ')}</label>
                      <input 
                        type="text" 
                        value={formData.metadata[key]} 
                        disabled={isAdmin}
                        onChange={e => handleMetadataChange(key, e.target.value)} 
                        className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-900" 
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-5 mt-2 gap-4">
              {isAdmin ? (
                <>
                  <button 
                    onClick={handleDelete}
                    disabled={isProcessing}
                    className="w-full sm:w-auto inline-flex items-center justify-center text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 font-semibold text-xs uppercase transition-colors disabled:opacity-50"
                  >
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {isProcessing ? 'Elaborazione...' : 'Elimina Asset'}
                  </button>
                  <div className="flex w-full sm:w-auto justify-end">
                    <button 
                      onClick={closeModal} 
                      disabled={isProcessing}
                      className="rounded-lg px-6 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                    >
                      Chiudi
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleDelete}
                    disabled={isProcessing}
                    className="w-full sm:w-auto inline-flex items-center justify-center text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 font-semibold text-xs uppercase transition-colors disabled:opacity-50"
                  >
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {isProcessing ? 'Elaborazione...' : 'Elimina Asset'}
                  </button>
                  
                  <div className="flex w-full sm:w-auto gap-3">
                    <button 
                      onClick={closeModal} 
                      disabled={isProcessing} 
                      className="flex-1 sm:flex-none rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      Annulla
                    </button>
                    <button 
                      onClick={handleUpdate} 
                      disabled={isProcessing} 
                      className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      Salva Modifiche
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}