import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import CampusMap from "./pages/Dashboard/CampusMap";
import Home from "./pages/Dashboard/Home"; 
import OperatorsManagement from "./pages/Admin/OperatorsManagement"; 
import CategoriesManagement from "./pages/Admin/CategoriesManagement";
import SystemLogs from "./pages/Admin/SystemLogs";
import NewCampus from './pages/Admin/CreateCampus';
import CampusList from './pages/Admin/CampusList';


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
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Home />} />
              
              <Route path="/admin/operators" element={<OperatorsManagement />} />
              
              <Route path="/admin/categories" element={<CategoriesManagement />} />

              <Route path="/admin/history" element={<SystemLogs />} />
              
              <Route path="/admin/campus/new" element={<NewCampus />} />

              <Route path="admin/campuses" element={<CampusList />} />
              
            </Route>
          </Route>

          {/* ========================================== */}
          {/* ROTTE OPERATORE                            */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['OPERATORE']} />}>
          </Route>

          {/* ========================================== */}
          {/* ROTTE UTENTE E GUEST (Studenti/Docenti)    */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['UTENTE', 'GUEST']} />}>
          </Route>
        </Routes>
      </Router>
    </>
  );
}