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
    // Não calcular tamanhos gzip durante build (mais rápido)
    reportCompressedSize: false,
    // Browsers ES2020 suportam modulepreload nativamente — polyfill desnecessário (~1.5 kB)
    modulePreload: { polyfill: false },
    // Minificar CSS separado de cada chunk
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // xlsx em chunk isolado — carregado apenas quando o utilizador usa "Importar Excel"
          if (id.includes("node_modules/xlsx")) {
            return "xlsx";
          }
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
