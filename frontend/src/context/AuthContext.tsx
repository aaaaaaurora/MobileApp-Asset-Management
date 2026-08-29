import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

// Interfaccia espansa con i dati anagrafici dal database
interface User {
  id: string;          
  role: string;        
  campus_ids: string[];
  category_id: string | null;
  first_name?: string; // Nuovi campi anagrafici
  last_name?: string;
  email?: string;
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
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Funzione asincrona per recuperare il profilo utente
    const fetchUserProfile = async (validToken: string, decodedToken: any) => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${validToken}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          // Unisce i permessi del JWT con i dati anagrafici presi dal DB
          setUser({
            id: decodedToken.sub,
            role: decodedToken.role,
            campus_ids: decodedToken.campus_ids || [],
            category_id: decodedToken.category_id || null,
            first_name: userData.first_name,
            last_name: userData.last_name,
            email: userData.email
          });
        } else {
          // Se la richiesta fallisce (es. token revocato o utente inattivo dal DB), scarta la sessione
          console.error("Errore nel recupero del profilo dal server");
          logout();
        }
      } catch (error) {
        console.error("Errore di rete durante il recupero del profilo", error);
        // Evitiamo il logout in caso di momentanea assenza di rete, mantenendo i dati base del JWT
      }
    };

    if (token) {
      try {
        // 1. Decodifica e validazione base del JWT
        const decoded: any = jwtDecode(token);
        
        // 2. Setup immediato per non bloccare il rendering e le rotte protette
        setUser({
          id: decoded.sub,
          role: decoded.role,
          campus_ids: decoded.campus_ids || [],
          category_id: decoded.category_id || null,
        });
        
        localStorage.setItem('jwt_token', token);

        // 3. Recupero in background dei dati anagrafici (nome, email)
        fetchUserProfile(token, decoded);

      } catch (error) {
        console.error("Token non valido o scaduto", error);
        logout();
      }
    } else {
      setUser(null);
      localStorage.removeItem('jwt_token');
    }
  }, [token]);

  const login = (newToken: string) => {
    setToken(newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('jwt_token');
  };

  const isAuthenticated = Boolean(token && user);

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