import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  base: "./", // <-- Modificato da "/" a "./"
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Separa le librerie pesanti in chunk indipendenti per evitare crash della RAM
            if (id.includes('maplibre') || id.includes('react-map-gl')) return 'vendor-map';
            if (id.includes('@capacitor')) return 'vendor-capacitor';
            if (id.includes('react/') || id.includes('react-dom/')) return 'vendor-react';
            return 'vendor-core'; // Tutto il resto
          }
        }
      }
    }
  }
});