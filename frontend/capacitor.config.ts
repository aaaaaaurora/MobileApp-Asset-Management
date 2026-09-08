import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unisa.asset',
  appName: 'Asset Management',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '644506126338-qcsqiesqrma3ttcu6hlg1etfnckm5r3o.apps.googleusercontent.com', 
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;