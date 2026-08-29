import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import CampusMap from "./pages/Dashboard/CampusMap";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import SignIn from "./pages/AuthPages/SignIn";
import CreateAsset from './pages/AssetPages/CreateAsset';
import TicketSegnalazioni from './pages/WarningPages/TicketSegnalazioni';
import AssetList from './pages/AssetPages/AssetList';

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          
          {/* ========================================== */}
          {/* ROTTE PROTETTE - BASE (Tutti gli autenticati) */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/map" element={<CampusMap />} />
            </Route>
          </Route>

          {/* ========================================== */}
          {/* ROTTE AMMINISTRATORE */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['AMMINISTRATORE']} />}>
  
          </Route>

          {/* ========================================== */}
          {/* ROTTE OPERATORE */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['OPERATORE']} />}>
            <Route element={<AppLayout />}>
              <Route path="/assets/new" element={<CreateAsset />} />
              <Route path="/operator/tickets" element={<TicketSegnalazioni />} />
              <Route path="/assets/list" element={<AssetList />} />
            </Route>
          </Route>

          {/* ========================================== */}
          {/* ROTTE UTENTE (Studenti/Docenti) */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['UTENTE']} />}>
          </Route>
        </Routes>
      </Router>
    </>
  );
}