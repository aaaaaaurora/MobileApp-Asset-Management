import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PageMeta from '../../components/common/PageMeta';
import { useAuth } from '../../context/AuthContext'; 

interface Attribute {
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  status: string;
}

interface Category {
  _id: string;
  name: string;
  attributes: Attribute[];
}

const CreateAsset: React.FC = () => {
  const { user, token } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryObj, setSelectedCategoryObj] = useState<Category | null>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [matchedCampusId, setMatchedCampusId] = useState<string | null>(null); 
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [metadata, setMetadata] = useState<Record<string, any>>({});

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOperator = user?.role === 'OPERATORE';

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/asset/api/categories`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Errore nel recupero delle categorie');
        const data = await response.json();
        setCategories(data);
      } catch (err) {
        setError("Impossibile caricare le categorie dal server.");
      }
    };

    if (token) fetchCategories();
  }, [token]);

  // Se l'utente è un operatore e le categorie sono caricate, imposta automaticamente la sua categoria e passa allo step successivo
  useEffect(() => {
    if (isOperator && user?.category_id && categories.length > 0) {
      setSelectedCategory(user.category_id);
      const catObj = categories.find(c => c._id === user.category_id);
      if (catObj) {
        setSelectedCategoryObj(catObj);
      }
    }
  }, [isOperator, user, categories]);

  const captureLocation = () => {
    setLoading('Acquisizione e validazione GPS...');
    setError(null);
    
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata dal browser.');
      setLoading(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const campusList = user?.campus_ids || [];

        if (campusList.length === 0) {
          setError('Nessun campus assegnato al tuo profilo.');
          setLoading(null);
          return;
        }
        
        try {
          const validationPromises = campusList.map(async (campusId: string) => {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/geozone/api/geozones/verify-location`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ campusId, latitudine: lat, longitudine: lng })
            });
            if (!res.ok) throw new Error(`Errore API per il campus ${campusId}`);
            const data = await res.json();
            return { campusId, isInside: data.is_inside };
          });

          const results = await Promise.allSettled(validationPromises);
          const validResult = results.find(
            (r) => r.status === 'fulfilled' && r.value.isInside
          );

          if (validResult && validResult.status === 'fulfilled') {
            setLocation({ lat, lng });
            setMatchedCampusId(validResult.value.campusId);
          } else {
            setError("Coordinate fuori perimetro! Ti trovi all'esterno di tutti i campus a te assegnati.");
          }
        } catch (err: any) {
          console.warn("Geozone check fallito, bypass temporaneo per test:", err);
          setError(`Impossibile validare il perimetro: ${err.message}. (Bypass attivo)`);
          setLocation({ lat, lng }); 
          setMatchedCampusId(campusList[0]);
        } finally {
          setLoading(null);
        }
      },
      (err) => {
        setError(`Errore GPS: ${err.message}. Controlla i permessi.`);
        setLoading(null);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (mediaId) {
        fetch(`${import.meta.env.VITE_API_URL}/media/images/${mediaId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(err => console.error("Errore cancellazione vecchia foto:", err));
        setMediaId(null);
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const executeCancelProcess = async () => {
    setIsCancelModalOpen(false); 
    
    if (mediaId) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/media/images/${mediaId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) { console.error("Errore pulizia file:", e); }
    }
    
    setStep(1);
    setLocation(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setMediaId(null);
    setAiSuggestions(null);
    setMetadata({});
    setMatchedCampusId(null);
    
    if (!isOperator) {
      setSelectedCategory('');
      setSelectedCategoryObj(null);
    }
  };

  const handleNextStep1 = () => {
    if (isOperator && selectedCategoryObj) {
      triggerAIAnalysis();
    } else {
      setStep(2);
    }
  };

  const triggerAIAnalysis = async () => {
    if (!selectedCategory || !photoFile) return;
    
    setError(null);
    let currentMediaId = mediaId;

    try {
      if (!currentMediaId) {
        setLoading('Upload in corso...');
        const formData = new FormData();
        formData.append('images', photoFile);

        const uploadRes = await fetch(`${import.meta.env.VITE_API_URL}/media/images/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }, 
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || uploadData.errors?.length > 0) {
          throw new Error(uploadData.errors?.[0]?.error || "Errore durante l'upload su MinIO.");
        }

        currentMediaId = uploadData.uploaded[0].media_id;
        setMediaId(currentMediaId);
      }

      setLoading('Analisi Computer Vision in corso...');
      const analyzeRes = await fetch(`${import.meta.env.VITE_API_URL}/media/images/${currentMediaId}/analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const analyzeData = await analyzeRes.json();

      if (analyzeData.status === "success" || analyzeData.status === "degraded") {
        setAiSuggestions(analyzeData.suggestions);
        if (analyzeData.suggestions?.suggested_title) {
          setMetadata(prev => ({ 
            ...prev, 
            tipologia: prev.tipologia || analyzeData.suggestions.suggested_title 
          }));
        }
      }

      setStep(3);
    } catch (err: any) {
      setError(`Errore Processo Media/IA: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleMetadataChange = (key: string, value: any) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  const submitAsset = async () => {
    setLoading('Salvataggio asset in corso...');
    setError(null);
    
    try {
      const payload = {
        category_id: selectedCategory,
        campus_id: matchedCampusId,
        media_id: mediaId, 
        geometry: { type: 'Point', coordinates: [location?.lng, location?.lat] },
        metadata: metadata
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/asset/api/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante il salvataggio sul server');
      }

      alert('Asset e Media salvati con successo in Database e Storage!');
      
      setStep(1);
      setLocation(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      setMediaId(null);
      setAiSuggestions(null);
      setMetadata({});
      setMatchedCampusId(null);

      if (!isOperator) {
        setSelectedCategory('');
        setSelectedCategoryObj(null);
      }
    } catch (err: any) {
      setError(err.message || 'Errore imprevisto durante il salvataggio.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <PageMeta title="Nuovo Asset | Asset Management UNISA" description='' />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Censimento Nuovo Asset
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Registra un nuovo elemento sul territorio con l'ausilio dell'Intelligenza Artificiale.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
          
          <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 py-2.5 px-4 flex justify-between items-center">
            <h3 className="font-bold text-base text-slate-800 dark:text-white">
              {isOperator ? `Fase ${step === 3 ? 2 : 1} di 2` : `Fase ${step} di 3`}
            </h3>
            <div className="flex gap-2">
              {isOperator ? (
                [1, 2].map((i) => (
                  <div key={i} className={`h-2 w-8 rounded-full transition-colors ${((step === 1 && i === 1) || (step === 3 && i >= 1)) ? 'bg-blue-600 shadow-sm' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                ))
              ) : (
                [1, 2, 3].map((i) => (
                  <div key={i} className={`h-2 w-8 rounded-full transition-colors ${step >= i ? 'bg-blue-600 shadow-sm' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {error && (
              <div className="mb-4 rounded-lg border-l-4 border-rose-500 bg-rose-50 p-3 text-rose-800 shadow-sm dark:bg-rose-900/20 dark:text-rose-400">
                <p className="font-semibold text-xs">{error}</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                {isOperator && selectedCategoryObj && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      Categoria Assegnata
                    </label>
                    <div className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300">
                      {selectedCategoryObj.name}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {isOperator ? '1. Posizione GPS e Validazione' : '1. Posizione GPS e Validazione'}
                  </label>
                  {location ? (
                    <div className="w-full rounded-lg border border-emerald-500 bg-emerald-50 py-2 px-3 text-emerald-700 text-sm font-semibold shadow-sm flex items-center gap-2 dark:bg-emerald-900/20 dark:text-emerald-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Coordinate acquisite: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </div>
                  ) : (
                    <button 
                      onClick={captureLocation}
                      disabled={!!loading}
                      className="flex w-full justify-center items-center rounded-lg bg-blue-600 p-2 text-sm font-bold text-white transition-all hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {loading === 'Acquisizione e validazione GPS...' ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Validazione in corso...
                        </span>
                      ) : 'Ottieni Posizione GPS'}
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {isOperator ? "2. Foto dell'Asset" : "2. Foto dell'Asset"}
                  </label>
                  <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handlePhotoCapture} className="hidden" />
                  
                  {photoPreview ? (
                    <div className="mt-1 relative group">
                      <img src={photoPreview} alt="Anteprima" className="w-full h-36 object-cover rounded-lg border border-slate-200 shadow-sm dark:border-slate-700" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-100 transition-colors">
                          Scatta un'altra foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="flex flex-col w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5 hover:bg-slate-100 hover:border-slate-400 transition-colors dark:bg-slate-800 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                    >
                      <svg className="h-8 w-8 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Apri Fotocamera</span>
                    </button>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                  <button 
                    disabled={!location || !photoFile || (isOperator && !selectedCategoryObj)} 
                    onClick={handleNextStep1} 
                    className="flex w-full justify-center items-center rounded-lg bg-blue-600 p-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOperator ? (
                      loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Elaborazione in corso...
                        </span>
                      ) : 'Carica Immagine e Analizza'
                    ) : 'Avanti'}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && !isOperator && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Seleziona Categoria Strutturale</label>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => {
                      const catId = e.target.value;
                      setSelectedCategory(catId);
                      setSelectedCategoryObj(categories.find(c => c._id === catId) || null);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
                  >
                    <option value="" disabled>Seleziona una categoria...</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
                  <button 
                    onClick={() => setStep(1)} 
                    className="w-full sm:w-1/3 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 border border-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
                  >
                    Indietro
                  </button>
                  <button 
                    onClick={triggerAIAnalysis} 
                    disabled={!!loading || !selectedCategory} 
                    className="flex w-full sm:w-2/3 justify-center items-center rounded-lg bg-blue-600 p-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        {loading}
                      </span>
                    ) : 'Carica Immagine e Analizza'}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                
                {aiSuggestions && (
                  <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-3 shadow-sm dark:bg-blue-900/20 dark:border-blue-400">
                    <h5 className="font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Analisi Cloud Vision
                    </h5>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mb-0.5">
                      <strong className="font-semibold text-slate-900 dark:text-white">Rilevamento primario:</strong> {aiSuggestions.suggested_title} 
                      <span className="text-[10px] text-slate-500 ml-1.5 font-medium">(Affidabilità: {(aiSuggestions.confidence_score * 100).toFixed(0)}%)</span>
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      <strong className="font-semibold text-slate-900 dark:text-white">Tag estratti:</strong> {aiSuggestions.tags.join(', ')}
                    </p>
                  </div>
                )}

                <div className="mb-2">
                  <h4 className="text-base font-bold text-slate-800 dark:text-white">Revisione Dati</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Compila i metadati per la categoria <span className="font-bold text-slate-700 dark:text-slate-300">"{selectedCategoryObj?.name}"</span>.
                  </p>
                </div>

                <div className="space-y-3">
                  {selectedCategoryObj?.attributes.map((attr) => (
                    <div key={attr.name}>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">
                        {attr.name.replace('_', ' ')} {attr.required && <span className="text-rose-500">*</span>}
                      </label>
                      
                      {attr.type === 'enum' ? (
                        <select 
                          value={metadata[attr.name] || ''} 
                          onChange={(e) => handleMetadataChange(attr.name, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
                        >
                          <option value="">Seleziona...</option>
                          {attr.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input 
                          type={attr.type === 'number' ? 'number' : 'text'}
                          value={metadata[attr.name] || ''}
                          onChange={(e) => handleMetadataChange(attr.name, attr.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-white dark:bg-slate-800"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-4 mt-4 gap-3">
                  <button 
                    onClick={() => setIsCancelModalOpen(true)} 
                    className="w-full sm:w-auto rounded-lg border border-rose-600 text-rose-600 px-4 py-2 text-sm font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  >
                    Annulla Censimento
                  </button>
                  
                  <div className="flex w-full sm:w-auto gap-2">
                    <button 
                      onClick={() => setStep(isOperator ? 1 : 2)} 
                      className="flex-1 sm:flex-none rounded-lg px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
                    >
                      Indietro
                    </button>
                    <button 
                      onClick={submitAsset} 
                      disabled={!!loading} 
                      className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Salvataggio...' : 'Conferma e Salva'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isCancelModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 text-center">
              <svg className="mx-auto mb-4 w-12 h-12 text-rose-600 dark:text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 className="mb-2 text-lg font-bold text-slate-800 dark:text-white">Annullare l'operazione?</h3>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                Sei sicuro di voler annullare? Tutti i dati inseriti e le foto acquisite andranno persi in modo irreversibile.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button 
                  onClick={() => setIsCancelModalOpen(false)} 
                  className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
                >
                  No, continua
                </button>
                <button 
                  onClick={executeCancelProcess} 
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-700 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                >
                  Sì, annulla tutto
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default CreateAsset;