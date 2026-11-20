import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
const target = loadEnv(mode, ".", "").ARENA_PROXY_TARGET || "http://127.0.0.1:8787";
const proxy = { "/api": { target }, "/ws": { target, ws: true } };

return {
  plugins: [react()],
  optimizeDeps: {
    include: [
      "monaco-editor/esm/vs/editor/editor.api",
      "monaco-editor/esm/vs/language/typescript/monaco.contribution",
    ],
  },
  preview: { host: "0.0.0.0", allowedHosts: true, proxy },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 5173,
    proxy,
  },
};
});
