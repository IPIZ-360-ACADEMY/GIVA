import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubPagesBuild = process.env.DEPLOY_TARGET === "gh-pages";

export default defineConfig({
  base: isGitHubPagesBuild ? "/GIVA/" : "/",
  plugins: [react()],
  build: {
    // Target browsers com suporte a ES modules modernos — menos polyfills
    target: "es2020",
    // Aviso apenas para chunks > 600KB (o padrão 500 gera falso alarme)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Supabase em chunk separado — carrega só quando precisa de auth/db
          if (id.includes("node_modules/@supabase")) {
            return "supabase";
          }
          // React core e router num único chunk de vendor leve
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/@remix-run/")
          ) {
            return "vendor";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: true
  }
});
