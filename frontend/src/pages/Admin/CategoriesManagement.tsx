import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";
import CategoriesTable from "../../components/admin/CategoriesTable";
import CategoryManagerModal from "../../components/admin/CategoryManagerModal";

export interface CategoryAttribute {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  required: boolean;
  filterable: boolean;
  editable: boolean;
  visible: boolean;
  options: string[];
  status: 'active' | 'unavailable';
}

export interface Category {
  _id: string;
  name: string;
  description: string;
  attributes: CategoryAttribute[];
  created_at: string;
  updated_at: string;
}

export default function CategoriesManagement() {
  const { token } = useAuth();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Stato Modale
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const fetchCategories = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      // Chiamata all'Asset Service tramite API Gateway
      const res = await fetch(`${baseUrl}/asset/api/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Errore nel caricamento delle categorie");
      const data = await res.json();
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [token]);

  const handleOpenCreate = () => {
    setSelectedCategory(null); // Modalità Creazione Nuova Categoria
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setSelectedCategory(category); // Modalità Gestione Avanzata
    setIsModalOpen(true);
  };

  return (
    <>
      <PageMeta
        title="Gestione Categorie Asset | Asset Management Unisa"
        description="Amministrazione delle categorie strutturali e dei metadati dinamici."
      />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Gestione Categorie Asset
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Modella dinamicamente le entità e i loro attributi personalizzati (Senza alterare il DB).
          </p>
        </div>
        
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuova Categoria
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border-l-4 border-rose-500 bg-rose-50 p-4 text-rose-800 shadow-sm">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4 text-emerald-800 shadow-sm">
          <p className="font-semibold">{successMsg}</p>
        </div>
      )}

      <CategoriesTable 
        categories={categories} 
        isLoading={isLoading} 
        onManageClick={handleOpenEdit} 
      />

      {/* Modale Unificato: Seleziona tra Creazione Base e Gestione Avanzata (Attributi) */}
      <CategoryManagerModal
        isOpen={isModalOpen}
        category={selectedCategory}
        onClose={() => setIsModalOpen(false)}
        onRefresh={() => {
          fetchCategories();
          setSuccessMsg("Operazione completata con successo!");
          setTimeout(() => setSuccessMsg(""), 4000);
        }}
      />
    </>
  );
}