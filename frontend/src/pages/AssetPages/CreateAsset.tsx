import React, { useState, useRef } from 'react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { useAuth } from '../../context/AuthContext'; // Decommenta quando unisci l'Auth

// Mock del Database Dinamico (MongoDB) per la Categoria "Albero"
const MOCK_CATEGORY = {
  id: 'cat-albero-001',
  name: 'Albero / Verde Pubblico',
  attributes: [
    { name: 'tipologia', label: 'Tipologia Specie', type: 'string', required: true },
    { name: 'altezza', label: 'Altezza stimata (metri)', type: 'number', required: true },
    { name: 'stato_salute', label: 'Stato di Salute', type: 'enum', options: ['Ottimo', 'Buono', 'Sofferente', 'Malato'], required: true }
  ]
};

const CreateAsset: React.FC = () => {
  // const { user } = useAuth();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dati dell'Asset
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [metadata, setMetadata] = useState<Record<string, any>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // US 3-1: Acquisizione GPS
  // ==========================================
  const captureLocation = () => {
    setLoading('Acquisizione coordinate GPS in corso...');
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata dal browser.');
      setLoading(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLoading(null);
      },
      (err) => {
        setError(`Errore GPS: ${err.message}. Controlla i permessi.`);
        setLoading(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ==========================================
  // US 3-2: Fotocamera / Immagine
  // ==========================================
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setPhotoPreview(imageUrl);
    }
  };

  // ==========================================
  // US 3-3: Selezione Categoria e CV (AI)
  // ==========================================
  const triggerAIAnalysis = () => {
    if (!selectedCategory) {
      setError("Seleziona una categoria per procedere.");
      return;
    }
    
    setError(null);
    setLoading('Analisi Computer Vision in corso...');

    // Simulazione chiamata REST al servizio AI
    setTimeout(() => {
      setMetadata({
        tipologia: 'Pinus Pinea (Pino Domestico)',
        altezza: 14.5,
        stato_salute: 'Buono'
      });
      setLoading(null);
      setStep(3);
    }, 2500);
  };

  // ==========================================
  // US 3-4: Revisione e Salvataggio
  // ==========================================
  const handleMetadataChange = (key: string, value: any) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  const submitAsset = async () => {
    setLoading('Salvataggio asset in corso...');
    try {
      const payload = {
        category_id: MOCK_CATEGORY.id,
        campus_id: '11111111-1111-1111-1111-111111111111', 
        geometry: { type: 'Point', coordinates: [location?.lng, location?.lat] },
        metadata: metadata
      };

      console.log('Payload inviato:', payload);
      
      // await fetch('...', { ... })

      alert('Asset censito con successo!');
      
      setStep(1);
      setLocation(null);
      setPhotoPreview(null);
      setMetadata({});
      setSelectedCategory('');
    } catch (err) {
      setError('Errore durante il salvataggio.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Nuovo Asset | Asset Management UNISA"
        description="Piattaforma di censimento asset tramite dispositivo mobile."
      />
      <PageBreadcrumb pageTitle="Censimento Nuovo Asset" />

      <div className="grid grid-cols-1 gap-9">
        <div className="flex flex-col gap-9">
          {/* Card Wrapper in stile Tailadmin */}
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
              <h3 className="font-medium text-black dark:text-white">
                Fase {step} di 3
              </h3>
              {/* Progress Bar */}
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i} 
                    className={`h-2 w-8 rounded-full ${step >= i ? 'bg-primary' : 'bg-stroke dark:bg-strokedark'}`}
                  ></div>
                ))}
              </div>
            </div>

            <div className="p-6.5">
              {error && (
                <div className="mb-6 flex w-full border-l-6 border-danger bg-danger/20 px-7 py-3 shadow-md dark:bg-[#1B1B24] dark:shadow-none">
                  <p className="text-danger">{error}</p>
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      1. Posizione GPS (US 3-1)
                    </label>
                    {location ? (
                      <div className="w-full rounded border border-success bg-success/10 py-3 px-4 text-success">
                        Coordinate acquisite: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                      </div>
                    ) : (
                      <button 
                        onClick={captureLocation}
                        className="flex w-full justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90"
                      >
                        {loading === 'Acquisizione coordinate GPS in corso...' ? 'Acquisizione...' : 'Ottieni Posizione Attuale'}
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      2. Foto dell'Asset (US 3-2)
                    </label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      ref={fileInputRef} 
                      onChange={handlePhotoCapture} 
                      className="hidden" 
                    />
                    {photoPreview ? (
                      <div className="mt-2">
                        <img src={photoPreview} alt="Anteprima" className="w-full h-48 object-cover rounded-md border border-stroke dark:border-strokedark mb-3" />
                        <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          Scatta un'altra foto
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full justify-center rounded border border-primary text-primary p-3 font-medium hover:bg-primary/10 transition"
                      >
                        Apri Fotocamera
                      </button>
                    )}
                  </div>

                  <button 
                    disabled={!location || !photoPreview} 
                    onClick={() => setStep(2)} 
                    className="mt-6 flex w-full justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Avanti
                  </button>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      Seleziona Categoria (US 3-3)
                    </label>
                    <div className="relative z-20 bg-transparent dark:bg-form-input">
                      <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent py-3 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      >
                        <option value="" disabled className="text-body dark:text-bodydark">Seleziona...</option>
                        <option value={MOCK_CATEGORY.id} className="text-body dark:text-bodydark">{MOCK_CATEGORY.name}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button 
                      onClick={() => setStep(1)} 
                      className="flex w-1/3 justify-center rounded border border-stroke p-3 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
                    >
                      Indietro
                    </button>
                    <button 
                      onClick={triggerAIAnalysis} 
                      disabled={!!loading || !selectedCategory}
                      className="flex w-2/3 justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90 disabled:opacity-50"
                    >
                      {loading ? 'Analisi in corso...' : '🤖 Analizza con IA'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="mb-5">
                    <h4 className="text-lg font-semibold text-black dark:text-white">Revisione Dati (US 3-4)</h4>
                    <p className="text-sm text-body dark:text-bodydark">Modifica i campi estratti dall'IA prima di confermare.</p>
                  </div>

                  {MOCK_CATEGORY.attributes.map((attr) => (
                    <div key={attr.name} className="mb-4">
                      <label className="mb-2.5 block font-medium text-black dark:text-white">
                        {attr.label} {attr.required && <span className="text-meta-1">*</span>}
                      </label>
                      
                      {attr.type === 'enum' ? (
                        <div className="relative z-20 bg-transparent dark:bg-form-input">
                          <select 
                            value={metadata[attr.name] || ''} 
                            onChange={(e) => handleMetadataChange(attr.name, e.target.value)}
                            className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent py-3 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          >
                            <option value="">Seleziona...</option>
                            {attr.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      ) : (
                        <input 
                          type={attr.type === 'number' ? 'number' : 'text'}
                          value={metadata[attr.name] || ''}
                          onChange={(e) => handleMetadataChange(attr.name, attr.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                          className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex gap-4 mt-6">
                    <button 
                      onClick={() => setStep(2)} 
                      className="flex w-1/3 justify-center rounded border border-stroke p-3 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
                    >
                      Indietro
                    </button>
                    <button 
                      onClick={submitAsset} 
                      disabled={!!loading}
                      className="flex w-2/3 justify-center rounded bg-success p-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                    >
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