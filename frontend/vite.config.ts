import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ]
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },
  // 🔥 IL FIX PER KUBERNETES/NGINX:
  // Forza Vite a creare un file .js normale invece di .mjs
  worker: {
    format: "iife"
  }
});