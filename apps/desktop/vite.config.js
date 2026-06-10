import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));

function spaFallbackPlugin() {
  return {
    name: "codeforge-spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url.startsWith("/auth/") && !url.includes(".")) {
          req.url = "/";
        }
        next();
      });
    },
    closeBundle() {
      const distIndex = resolve(rootDir, "dist", "index.html");
      const callbackIndex = resolve(rootDir, "dist", "auth", "callback", "index.html");
      mkdirSync(dirname(callbackIndex), { recursive: true });
      copyFileSync(distIndex, callbackIndex);
    },
  };
}

export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  optimizeDeps: {
    include: ["@codeforge/ui", "react-markdown", "remark-gfm", "highlight.js"],
  },
  appType: "spa",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  preview: {
    port: 1420,
    strictPort: true,
  },
});
