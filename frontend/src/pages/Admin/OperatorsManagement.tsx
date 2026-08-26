import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";
import OperatorsTable from "../../components/admin/OperatorsTable";
import OperatorModal from "../../components/admin/OperatorModal";

// --- ESPORTAZIONE DELLE INTERFACCE ---
export interface Operator {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  campus_ids: string[];
  category_id: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Campus {
  id: string;
  name: string;
}

export interface OperatorFormData {
  email: string;
  category_id: string;
  campus_ids: string[];
}

export default function OperatorsManagement() {
  const { token } = useAuth();

  // Stati dei dati
  const [operators, setOperators] = useState<Operator[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stati del Modale
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOperatorId, setCurrentOperatorId] = useState<string | null>(null);
  const [modalError, setModalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stato iniziale per il form del modale
  const emptyForm: OperatorFormData = { email: "", category_id: "", campus_ids: [] };
  const [formData, setFormData] = useState<OperatorFormData>(emptyForm);

  // Messaggio globale di successo (opzionale, per dare un feedback visivo)
  const [successMessage, setSuccessMessage] = useState("");

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Chiamate parallele per ottimizzare i tempi di caricamento
      const [opsRes, catRes, campusRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || ''}/auth/admin/operators`, { headers }),
        fetch(`/api/categories`, { headers }).catch(() => ({ ok: false, json: () => [] })),
        fetch(`/api/campus`, { headers }).catch(() => ({ ok: false, json: () => [] }))
      ]);

      if (opsRes.ok) setOperators(await opsRes.json());
      
      // Dati di fallback per permetterti di testare l'interfaccia se gli altri endpoint non esistono ancora
      setCategories(catRes.ok ? await catRes.json() : [
        { id: "cat-1", name: "Informatica e IT" },
        { id: "cat-2", name: "Manutenzione Edile" }
      ]);
      setCampuses(campusRes.ok ? await campusRes.json() : [
        { id: "campus_fisciano", name: "Campus Fisciano" },
        { id: "campus_baronissi", name: "Campus Baronissi" }
      ]);

    } catch (error) {
      console.error("Errore nel caricamento dei dati:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Gestori apertura/chiusura modale
  const handleOpenCreate = () => {
    setIsEditing(false);
    setCurrentOperatorId(null);
    setFormData(emptyForm);
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (op: Operator) => {
    setIsEditing(true);
    setCurrentOperatorId(op.id);
    setFormData({
      email: op.email,
      category_id: op.category_id || "",
      campus_ids: op.campus_ids || [],
    });
    setModalError("");
    setIsModalOpen(true);
  };

  // Logica di salvataggio (invocata dal Componente Modale)
  const handleModalSubmit = async (submittedData: OperatorFormData) => {
    setModalError("");
    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const url = isEditing 
        ? `${import.meta.env.VITE_API_URL || ''}/auth/admin/operators/${currentOperatorId}`
        : `${import.meta.env.VITE_API_URL || ''}/auth/admin/operators`;
        
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // Se in modifica, inviamo solo categorie e campus (backend ignora la mail)
        body: JSON.stringify(isEditing 
          ? { category_id: submittedData.category_id, campus_ids: submittedData.campus_ids }
          : submittedData
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore sconosciuto durante il salvataggio.");
      }

      // Successo! Ricarichiamo la lista e chiudiamo
      await fetchData();
      setIsModalOpen(false);
      
      // Mostriamo un feedback all'utente
      setSuccessMessage(isEditing ? "Permessi aggiornati con successo!" : "Profilo Operatore creato. Ora può accedere tramite Google.");
      setTimeout(() => setSuccessMessage(""), 5000); // Rimuove l'avviso dopo 5 secondi

    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Gestione Operatori | Asset Management Unisa"
        description="Amministrazione profili tecnici e assegnazione campus/categorie."
      />

      {/* HEADER DELLA PAGINA */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black dark:text-white">
            Gestione Operatori
          </h2>
          <p className="text-sm text-gray-500">
            Configura le autorizzazioni e i perimetri geografici del personale tecnico.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-center font-medium text-white hover:bg-opacity-90 transition-all shadow-sm"
        >
          + Nuovo Operatore
        </button>
      </div>

      {/* FEEDBACK GLOBALE (Successo) */}
      {successMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 dark:border-green-900 dark:bg-green-500/10 dark:text-green-400">
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {/* COMPONENTE TABELLA */}
      <OperatorsTable 
        operators={operators} 
        categories={categories} 
        isLoading={isLoading} 
        onEditClick={handleOpenEdit} 
      />

      {/* COMPONENTE MODALE */}
      <OperatorModal
        isOpen={isModalOpen}
        isEditing={isEditing}
        initialData={formData}
        categories={categories}
        campuses={campuses}
        error={modalError}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </>
  );
}