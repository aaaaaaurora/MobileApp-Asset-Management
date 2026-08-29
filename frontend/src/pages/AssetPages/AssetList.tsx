import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';

interface CategoryAttribute {
  name: string;
  type: string;
  required: boolean;
}

interface Category {
  _id: string;
  name: string;
  attributes: CategoryAttribute[];
}

interface Asset {
  _id: string;
  category_id: string;
  campus_id: string;
  geometry: { type: string; coordinates: [number, number] };
  metadata: Record<string, any>;
  media_ids?: string[]; // Aggiunto per le foto
  status: string;
  created_at: string;
}

export default function AssetList() {
  const { token, user } = useAuth();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Stati per la modale di Modifica/Eliminazione
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [formData, setFormData] = useState<{ lat: number; lng: number; metadata: Record<string, any>; media_ids: string[] }>({ lat: 0, lng: 0, metadata: {}, media_ids: [] });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const catRes = await fetch(`${import.meta.env.VITE_API_URL}/asset/api/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
      }

      const assetRes = await fetch(`${import.meta.env.VITE_API_URL}/asset/api/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (assetRes.ok) {
        const assetData = await assetRes.json();
        setAssets(assetData.assets || []);
      }
    } catch (error) {
      console.error("Errore nel recupero dati:", error);
    } finally {
      setLoading(false);
    }
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
  };

  const handleMetadataChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [key]: value }
    }));
  };

  // --------------------------------------------------------
  // LOGICA GESTIONE IMMAGINI (MEDIA SERVICE)
  // --------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Usiamo FormData per simulare un form multipart/form-data
    const uploadPayload = new FormData();
    uploadPayload.append('images', file);

    setIsProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/media/images/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: uploadPayload // Il browser imposterà automaticamente il Content-Type corretto con il boundary
      });

      if (!res.ok) throw new Error("Errore durante il caricamento dell'immagine");
      
      const data = await res.json();
      const newMediaId = data.uploaded[0].media_id;

      // Aggiungiamo il nuovo ID all'array locale
      setFormData(prev => ({ ...prev, media_ids: [...prev.media_ids, newMediaId] }));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteImage = async (mediaId: string) => {
    if (!window.confirm("Vuoi eliminare definitivamente questa foto?")) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/media/images/${mediaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Errore durante l'eliminazione dell'immagine dallo storage");

      // Rimuoviamo l'ID dall'array locale
      setFormData(prev => ({ ...prev, media_ids: prev.media_ids.filter(id => id !== mediaId) }));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------
  // LOGICA SALVATAGGIO ASSET
  // --------------------------------------------------------
  const handleUpdate = async () => {
    if (!selectedAsset) return;
    setIsProcessing(true);

    const payload = {
      geometry: { type: 'Point', coordinates: [formData.lng, formData.lat] },
      metadata: formData.metadata,
      media_ids: formData.media_ids // Questo array aggiornato andrà a MongoDB
    };

    try {
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
        throw new Error(err.error || "Errore durante l'aggiornamento");
      }

      alert("Asset aggiornato con successo!");
      setSelectedAsset(null);
      fetchData(); 
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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore durante l'eliminazione");
      }

      alert("Asset eliminato con successo!");
      setSelectedAsset(null);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeCategory = selectedAsset ? categories.find(c => c._id === selectedAsset.category_id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-title-md2 font-semibold text-black dark:text-white">Lista Asset Censiti</h2>
        <button onClick={fetchData} className="text-sm text-blue-600 hover:underline">Aggiorna Lista</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4">
                <th className="py-4 px-4 font-medium text-black dark:text-white xl:pl-11">Categoria</th>
                <th className="py-4 px-4 font-medium text-black dark:text-white">ID Seriale</th>
                <th className="py-4 px-4 font-medium text-black dark:text-white">Data Creazione</th>
                <th className="py-4 px-4 font-medium text-black dark:text-white">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-5 text-center text-gray-500">Caricamento asset in corso...</td></tr>
              ) : assets.length === 0 ? (
                <tr><td colSpan={4} className="py-5 text-center text-gray-500">Nessun asset trovato nel tuo campus.</td></tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset._id}>
                    <td className="border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11">
                      <p className="text-sm font-medium text-black dark:text-white uppercase">{getCategoryName(asset.category_id)}</p>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <p className="text-sm text-gray-500">{asset._id}</p>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <p className="text-sm text-black dark:text-white">
                        {new Date(asset.created_at).toLocaleDateString('it-IT')}
                      </p>
                    </td>
                    <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                      <button
                        onClick={() => openEditModal(asset)}
                        className="rounded bg-blue-600 py-1 px-3 text-xs font-medium text-white hover:bg-blue-700 transition"
                      >
                        Visualizza / Modifica
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-boxdark border border-stroke dark:border-strokedark max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-stroke dark:border-strokedark pb-3">
              <h3 className="font-bold text-lg text-black dark:text-white">Gestione Asset</h3>
              <button onClick={() => setSelectedAsset(null)} className="text-gray-500 hover:text-black dark:hover:text-white font-bold">✕</button>
            </div>

            {/* SEZIONE FOTO */}
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-black dark:text-white mb-2">Gestione Foto</h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {formData.media_ids.map(mediaId => (
                  <div key={mediaId} className="relative min-w-[100px] h-24 flex-shrink-0">
                    <img 
                      src={`${import.meta.env.VITE_API_URL}/media/images/${mediaId}`} 
                      className="w-full h-full object-cover rounded border border-stroke dark:border-strokedark"
                      alt="Asset Media" 
                    />
                    <button 
                      onClick={() => handleDeleteImage(mediaId)} 
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-700 transition"
                      title="Elimina foto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                
                {/* Bottone per Aggiungere Nuova Foto */}
                <label className="min-w-[100px] h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-50 dark:border-strokedark dark:hover:bg-meta-4 transition">
                  <span className="text-2xl text-gray-400">+</span>
                  <span className="text-[10px] text-gray-500">Aggiungi</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isProcessing} />
                </label>
              </div>
            </div>

            {/* Sezione Coordinate */}
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-black dark:text-white mb-2">Coordinate Geografiche</h4>
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Latitudine</label>
                  <input type="number" step="any" value={formData.lat} onChange={e => setFormData(p => ({...p, lat: parseFloat(e.target.value)}))} className="w-full rounded border border-stroke bg-transparent py-2 px-3 text-sm outline-none transition focus:border-blue-600 active:border-blue-600 dark:border-form-strokedark dark:bg-form-input text-black dark:text-white" />
                </div>
                <div className="w-1/2">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Longitudine</label>
                  <input type="number" step="any" value={formData.lng} onChange={e => setFormData(p => ({...p, lng: parseFloat(e.target.value)}))} className="w-full rounded border border-stroke bg-transparent py-2 px-3 text-sm outline-none transition focus:border-blue-600 active:border-blue-600 dark:border-form-strokedark dark:bg-form-input text-black dark:text-white" />
                </div>
              </div>
            </div>

            {/* Sezione Metadati Dinamici */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-black dark:text-white mb-2">Metadati</h4>
              <div className="flex flex-col gap-3">
                {activeCategory ? (
                  activeCategory.attributes.map(attr => (
                    <div key={attr.name}>
                      <label className="mb-1 block text-xs font-medium text-gray-500 capitalize">{attr.name.replace('_', ' ')} {attr.required && '*'}</label>
                      <input 
                        type={attr.type === 'number' ? 'number' : 'text'} 
                        value={formData.metadata[attr.name] || ''} 
                        onChange={e => handleMetadataChange(attr.name, attr.type === 'number' ? parseFloat(e.target.value) : e.target.value)} 
                        className="w-full rounded border border-stroke bg-transparent py-2 px-3 text-sm outline-none transition focus:border-blue-600 active:border-blue-600 dark:border-form-strokedark dark:bg-form-input text-black dark:text-white" 
                      />
                    </div>
                  ))
                ) : (
                  Object.keys(formData.metadata).map(key => (
                    <div key={key}>
                      <label className="mb-1 block text-xs font-medium text-gray-500 capitalize">{key.replace('_', ' ')}</label>
                      <input type="text" value={formData.metadata[key]} onChange={e => handleMetadataChange(key, e.target.value)} className="w-full rounded border border-stroke bg-transparent py-2 px-3 text-sm outline-none transition focus:border-blue-600 active:border-blue-600 dark:border-form-strokedark dark:bg-form-input text-black dark:text-white" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pulsanti Azione */}
            {(user?.role === 'OPERATORE' || user?.role === 'AMMINISTRATORE') && (
              <div className="flex justify-between items-center border-t border-stroke dark:border-strokedark pt-4 mt-2">
                <button 
                  onClick={handleDelete}
                  disabled={isProcessing}
                  className="rounded bg-red-600 py-2 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {isProcessing ? 'Elaborazione...' : 'Elimina Asset'}
                </button>
                
                <div className="flex gap-2">
                  <button onClick={() => setSelectedAsset(null)} disabled={isProcessing} className="rounded border border-stroke py-2 px-4 text-sm font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white transition">Annulla</button>
                  <button onClick={handleUpdate} disabled={isProcessing} className="rounded bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition">
                    Salva Modifiche
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>, document.body
      )}
    </div>
  );
}