import { createContext, useContext, useState, ReactNode } from 'react';
//import { jwtDecode } from 'jwt-decode';

// Interfaccia basata sul payload del tuo backend app.py
interface User {
  id: string;          // Mappato dal 'sub' del JWT
  role: string;        // 'GUEST', 'OPERATORE', 'AMMINISTRATORE'
  campus_ids: string[];
  category_id: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  
  // ========================================================
  // --- LOGICA REALE (COMMENTATA TEMPORANEAMENTE) ---
  // ========================================================
  /*
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setUser({
          id: decoded.sub,
          role: decoded.role,
          campus_ids: decoded.campus_ids || [],
          category_id: decoded.category_id || null,
        });
        localStorage.setItem('jwt_token', token);
      } catch (error) {
        console.error("Token non valido", error);
        logout();
      }
    } else {
      setUser(null);
      localStorage.removeItem('jwt_token');
    }
  }, [token]);

  const login = (newToken: string) => setToken(newToken);
  const logout = () => setToken(null);
  */


  // ========================================================
  // --- LOGICA MOCKATA (PER TESTARE FRONTEND E SIDEBAR) ---
  // ========================================================
  
  // Token fittizio
  const [token] = useState<string | null>('mock-jwt-token-12345');
  
  // Utente fittizio. 
  // ⬇️ CAMBIA 'AMMINISTRATORE' IN 'OPERATORE' O 'UTENTE' PER TESTARE I VARI MENU
  const [user] = useState<User | null>({
    id: 'admin-mock-123',
    role: 'AMMINISTRATORE', 
    campus_ids: ['Fisciano'],
    category_id: null,
  });

  // Funzioni svuotate per il mock
  const login = (newToken: string) => console.log("Login chiamato con token:", newToken);
  const logout = () => console.log("Logout chiamato");

  return (
    // isAuthenticated è forzato a 'true'
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: true }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve essere usato in un AuthProvider');
  }
  return context;
};