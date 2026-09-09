import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unisa.asset',
  appName: 'Asset Management',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  plugins: {
    // 1. Abilitiamo le chiamate di rete native aggirando la WebView
    CapacitorHttp: {
      enabled: true,
    },
    // 2. Manteniamo la configurazione del login
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '644506126338-fvtr7mf0jpa9dusa58g8ilt0e9d2ftsr.apps.googleusercontent.com'
    },
  },
};

export default config;