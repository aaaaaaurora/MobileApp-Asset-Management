import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from './context/ThemeContext'; 
import VConsole from 'vconsole'; // <-- 1. Importa VConsole

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Avviamo vConsole sempre, temporaneamente, per scovare l'errore nell'APK
new VConsole();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <GoogleOAuthProvider clientId={clientId}>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </HelmetProvider>
  </React.StrictMode>,
);