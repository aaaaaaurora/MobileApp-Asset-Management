import React, { useState, useRef, useEffect } from 'react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
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

  // Stati per le Categorie
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryObj, setSelectedCategoryObj] = useState<Category | null>(null);

  // Stati Dati Asset
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [matchedCampusId, setMatchedCampusId] = useState<string | null>(null); // NUOVO: salva in quale campus ci troviamo
  
  // Stati Media e IA
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [metadata, setMetadata] = useState<Record<string, any>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // INIZIALIZZAZIONE: Categorie
  // ==========================================
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
        console.error("Errore fetch categorie:", err);
        setError("Impossibile caricare le categorie dal server.");
      }
    };

    if (token) fetchCategories();
  }, [token]);

  // ==========================================
  // US 3-1: GPS e Validazione Geozone Multi-Campus
  // ==========================================
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
          // Creiamo un array di chiamate API in parallelo per tutti i campus assegnati all'operatore
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

          // Aspettiamo che tutti i controlli PostGIS finiscano
          const results = await Promise.allSettled(validationPromises);
          
          // Cerchiamo se c'è ALMENO UN campus in cui l'utente si trova
          const validResult = results.find(
            (r) => r.status === 'fulfilled' && r.value.isInside
          );

          if (validResult && validResult.status === 'fulfilled') {
            // MATCH TROVATO: siamo dentro un campus!
            setLocation({ lat, lng });
            setMatchedCampusId(validResult.value.campusId);
          } else {
            // NESSUN MATCH
            setError("Coordinate fuori perimetro! Ti trovi all'esterno di tutti i campus a te assegnati.");
            //setLocation({ lat, lng }); 
            //setMatchedCampusId(campusList[0]);
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

  // ==========================================
  // US 3-2: Capture Immagine (Salvataggio in RAM)
  // ==========================================
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // ==========================================
  // US 3-2 & 3-3: Upload su MinIO e Analisi Vision
  // ==========================================
  const triggerAIAnalysis = async () => {
    if (!selectedCategory || !photoFile) return;
    
    setError(null);
    setLoading('Upload in corso...');

    try {
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

      const uploadedMediaId = uploadData.uploaded[0].media_id;
      setMediaId(uploadedMediaId);

      setLoading('Analisi Computer Vision in corso...');
      const analyzeRes = await fetch(`${import.meta.env.VITE_API_URL}/media/images/${uploadedMediaId}/analyze`, {
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

  // ==========================================
  // US 3-4: Salvataggio Finale su Asset DB
  // ==========================================
  const submitAsset = async () => {
    setLoading('Salvataggio asset in corso...');
    setError(null);
    
    try {
      const payload = {
        category_id: selectedCategory,
        campus_id: matchedCampusId, // ORA USA IL CAMPUS RILEVATO DAL GPS!
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
      setSelectedCategory('');
      setSelectedCategoryObj(null);
      setMatchedCampusId(null);
    } catch (err: any) {
      setError(err.message || 'Errore imprevisto durante il salvataggio.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <PageMeta title="Nuovo Asset | Asset Management UNISA" description='' />
      <PageBreadcrumb pageTitle="Censimento Nuovo Asset" />

      <div className="grid grid-cols-1 gap-9">
        <div className="flex flex-col gap-9">
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
              <h3 className="font-medium text-black dark:text-white">Fase {step} di 3</h3>
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-2 w-8 rounded-full ${step >= i ? 'bg-primary' : 'bg-stroke dark:bg-strokedark'}`}></div>
                ))}
              </div>
            </div>

            <div className="p-6.5">
              {error && (
                <div className="mb-6 flex w-full border-l-6 border-danger bg-danger/20 px-7 py-3 shadow-md">
                  <p className="text-danger font-medium">{error}</p>
                </div>
              )}

              {/* STEP 1: Acquisizione Posizione e Foto */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">1. Posizione GPS e Validazione Campus</label>
                    {location ? (
                      <div className="w-full rounded border border-success bg-success/10 py-3 px-4 text-success font-medium">
                        ✓ Coordinate acquisite: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                      </div>
                    ) : (
                      <button 
                        onClick={captureLocation}
                        disabled={!!loading}
                        className="flex w-full justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90 disabled:opacity-70"
                      >
                        {loading === 'Acquisizione e validazione GPS...' ? 'Validazione su PostGIS...' : 'Ottieni Posizione e Valida'}
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">2. Foto dell'Asset</label>
                    <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handlePhotoCapture} className="hidden" />
                    {photoPreview ? (
                      <div className="mt-2">
                        <img src={photoPreview} alt="Anteprima" className="w-full h-48 object-cover rounded-md border border-stroke mb-3" />
                        <button onClick={() => fileInputRef.current?.click()} className="text-primary hover:underline text-sm font-medium">
                          Scatta un'altra foto
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => fileInputRef.current?.click()} className="flex w-full justify-center rounded border border-primary text-primary p-3 font-medium hover:bg-primary/10">
                        Apri Fotocamera
                      </button>
                    )}
                  </div>

                  <button disabled={!location || !photoFile} onClick={() => setStep(2)} className="mt-6 flex w-full justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90 disabled:opacity-50">
                    Avanti
                  </button>
                </div>
              )}

              {/* STEP 2: Categoria e Upload */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">Seleziona Categoria</label>
                    <select 
                      value={selectedCategory}
                      onChange={(e) => {
                        const catId = e.target.value;
                        setSelectedCategory(catId);
                        setSelectedCategoryObj(categories.find(c => c._id === catId) || null);
                      }}
                      className="w-full rounded border border-stroke bg-transparent py-3 px-5 outline-none focus:border-primary dark:border-form-strokedark dark:text-white"
                    >
                      <option value="" disabled>Seleziona...</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button onClick={() => setStep(1)} className="flex w-1/3 justify-center rounded border border-stroke p-3 font-medium hover:shadow-1 dark:text-white">
                      Indietro
                    </button>
                    <button onClick={triggerAIAnalysis} disabled={!!loading || !selectedCategory} className="flex w-2/3 justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90 disabled:opacity-50">
                      {loading ? loading : 'Carica Immagine e Analizza'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Form Dinamico e AI */}
              {step === 3 && (
                <div className="space-y-6">
                  
                  {aiSuggestions && (
                    <div className="rounded border-l-4 border-primary bg-primary/5 p-4 dark:bg-meta-4">
                      <h5 className="font-semibold text-primary mb-2 flex items-center gap-2">
                        <span>🧠</span> Analisi Cloud Vision Completata
                      </h5>
                      <p className="text-sm text-black dark:text-white mb-1">
                        <strong>Rilevamento primario:</strong> {aiSuggestions.suggested_title} 
                        <span className="text-xs text-body ml-2">(Affidabilità: {(aiSuggestions.confidence_score * 100).toFixed(0)}%)</span>
                      </p>
                      <p className="text-sm text-black dark:text-white">
                        <strong>Tag estratti:</strong> {aiSuggestions.tags.join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="mb-5">
                    <h4 className="text-lg font-semibold text-black dark:text-white">Revisione Dati</h4>
                    <p className="text-sm text-body dark:text-bodydark">Categoria: <span className="font-bold">{selectedCategoryObj?.name}</span></p>
                  </div>

                  {selectedCategoryObj?.attributes.map((attr) => (
                    <div key={attr.name} className="mb-4">
                      <label className="mb-2.5 block font-medium text-black dark:text-white capitalize">
                        {attr.name.replace('_', ' ')} {attr.required && <span className="text-meta-1">*</span>}
                      </label>
                      
                      {attr.type === 'enum' ? (
                        <select 
                          value={metadata[attr.name] || ''} 
                          onChange={(e) => handleMetadataChange(attr.name, e.target.value)}
                          className="w-full rounded border border-stroke bg-transparent py-3 px-5 outline-none focus:border-primary dark:border-form-strokedark dark:text-white"
                        >
                          <option value="">Seleziona...</option>
                          {attr.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input 
                          type={attr.type === 'number' ? 'number' : 'text'}
                          value={metadata[attr.name] || ''}
                          onChange={(e) => handleMetadataChange(attr.name, attr.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                          className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 outline-none focus:border-primary dark:border-form-strokedark dark:text-white"
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex gap-4 mt-6">
                    <button onClick={() => setStep(2)} className="flex w-1/3 justify-center rounded border border-stroke p-3 font-medium hover:shadow-1 dark:text-white">
                      Indietro
                    </button>
                    <button onClick={submitAsset} disabled={!!loading} className="flex w-2/3 justify-center rounded bg-success p-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-50">
                      {loading ? 'Salvataggio...' : 'Conferma e Salva'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateAsset;