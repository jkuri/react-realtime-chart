import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), checker({ typescript: true /* biome: { command: "check" } */ })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react-realtime-chart": path.resolve(__dirname, "./lib"),
    },
  },
  server: { port: 3000, open: true },
  build: { outDir: "build", emptyOutDir: true, chunkSizeWarningLimit: 3000 },
});
