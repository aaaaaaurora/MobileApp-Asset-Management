import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: string;
  role: string;
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
  // Inizializza lo stato leggendo il localStorage (mantiene l'utente loggato al refresh della pagina)
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      try {
        // Decodifica il token per estrarre le info dell'utente
        const decoded: any = jwtDecode(token);
        
        setUser({
          id: decoded.sub,
          role: decoded.role,
          campus_ids: decoded.campus_ids || [],
          category_id: decoded.category_id || null,
        });
        
        // Salva il token nel browser
        localStorage.setItem('jwt_token', token);
      } catch (error) {
        console.error("Token non valido o scaduto", error);
        logout(); // Se il token è manomesso, butta fuori l'utente
      }
    } else {
      setUser(null);
      localStorage.removeItem('jwt_token');
    }
  }, [token]);

  // Funzioni esposte dal contesto
  const login = (newToken: string) => setToken(newToken);
  const logout = () => setToken(null);

  // L'utente è autenticato solo se abbiamo sia il token che i dati decodificati 
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
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