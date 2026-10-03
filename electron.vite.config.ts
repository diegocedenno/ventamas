import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import type { Plugin } from "vite";

const alias = {
  "@shared": resolve(__dirname, "src/shared"),
  "@modules": resolve(__dirname, "src/modules"),
};

// La aplicación instalada solo carga sus propios archivos. En desarrollo no se aplica,
// porque el servidor de Vite necesita scripts en línea para la recarga en caliente.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'";

function contentSecurityPolicy(): Plugin {
  return {
    name: "ventamas-csp",
    transformIndexHtml(html, context) {
      const meta = context.server ? "" : `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
      return html.replace("<!--csp-->", meta);
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
  },
  renderer: {
    plugins: [react(), contentSecurityPolicy()],
    resolve: { alias },
    build: { minify: "esbuild" },
  },
});
