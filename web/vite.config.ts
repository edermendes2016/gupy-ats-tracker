import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Em desenvolvimento, /api vai para o BFF (server/). Mesma origem para o navegador.
const BFF = process.env.BFF_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: { "/api": { target: BFF } },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
  },
});
