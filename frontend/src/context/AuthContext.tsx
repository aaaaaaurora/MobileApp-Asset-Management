import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Interfaccia basata sul payload del tuo backend app.py
export interface User {
  id: string;          // Mappato dal 'sub' del JWT
  role: string;        // 'GUEST', 'OPERATORE', 'AMMINISTRATORE'
  campus_ids: string[];
  category_id: string | null;
  email?: string;
  name?: string;
  first_name?: string;  
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Funzione sicura per decodificare il JWT senza librerie esterne
const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Errore nella decodifica del token", error);
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  
  // Inizializza il token dal localStorage se presente
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      const decoded = decodeJWT(token);
      if (decoded) {
        setUser({
          id: decoded.sub,
          role: decoded.role || 'UTENTE',
          campus_ids: decoded.campus_ids || [],
          category_id: decoded.category_id || null,
          email: decoded.email,
          name: decoded.name,
          first_name: decoded.first_name,
        });
        localStorage.setItem('jwt_token', token);
      } else {
        // Token corrotto, puliamo tutto
        setToken(null);
        localStorage.removeItem('jwt_token');
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

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      isAuthenticated: !!token 
    }}>
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