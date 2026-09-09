import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  base: "./", 
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
            // Isoliamo SOLO le librerie pesanti che causano il crash della RAM
            if (id.includes('maplibre') || id.includes('react-map-gl')) return 'vendor-map';
            if (id.includes('@capacitor')) return 'vendor-capacitor';
            // React e le librerie core vengono gestite automaticamente da Vite in modo sicuro
          }
        }
      }
    }
  }
});