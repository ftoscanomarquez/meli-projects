import { defineConfig, devices } from "@playwright/test";

// E2E (Fase 9) — ver AGENTS.md §11. Requiere `npm run dev` y `npx partykit dev`
// corriendo en paralelo (ver QUICK-START.md); no los levanta automáticamente
// porque ambos dependen de Mongo/Mailpit ya arriba, fuera del control de
// Playwright. `npm run test:e2e` asume ese entorno ya está de pie.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1, // los tests comparten Mongo/Mailpit/dev-server reales — evita condiciones de carrera entre specs
  retries: 0,
  globalTeardown: "./tests/e2e/helpers/globalTeardown.ts",
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  timeout: 45_000,
});
