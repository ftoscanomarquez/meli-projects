import { defineConfig } from "vitest/config";
import path from "node:path";

// Pruebas unitarias (Fase 9) — ver AGENTS.md §11. Cubre lógica pura:
// puntaje, RNG determinista, esquemas Zod, reducers de Zustand. El motor de
// PixiJS/PartyKit se prueba con Playwright (E2E, navegador real), no aquí.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
