import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import CampusMap from "./pages/Dashboard/CampusMap";

// 👇 AGGIUNTO IMPORT DI HOME (Verifica che il percorso sia corretto)
import Home from "./pages/Dashboard/Home"; 

// Importa il buttafuori che protegge le rotte
import ProtectedRoute from "./components/auth/ProtectedRoute";
import SignIn from "./pages/AuthPages/SignIn";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/signin" element={<SignIn />} />

          {/* ========================================== */}
          {/* ROTTE LIBERE (Accessibili senza login!)      */}
          {/* ========================================== */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Home />} />
          </Route>

          {/* ========================================== */}
          {/* ROTTE PROTETTE - BASE (Tutti gli autenticati) */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/map" element={<CampusMap />} />
            </Route>
          </Route>

          {/* ========================================== */}
          {/* ROTTE AMMINISTRATORE                       */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['AMMINISTRATORE']} />}>
  
          </Route>

          {/* ========================================== */}
          {/* ROTTE OPERATORE                            */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['OPERATORE']} />}>
          </Route>

          {/* ========================================== */}
          {/* ROTTE UTENTE (Studenti/Docenti)              */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['UTENTE']} />}>
          </Route>
        </Routes>
      </Router>
    </>
  );
}