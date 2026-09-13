import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development the SPA is served by Vite and the API by `wrangler dev`.
    // Proxying keeps the browser on one origin, so requests look exactly as
    // they will in production and no CORS handling is needed anywhere.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Read by wrangler as the static assets directory.
    outDir: "dist",
    sourcemap: true,
  },
});
