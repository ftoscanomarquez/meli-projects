import { cleanupE2eTestData } from "./db";

// Corre una sola vez al final de toda la suite — ver AGENTS.md §11 y
// playwright.config.ts. Borra únicamente cuentas con prefijo `e2e-`.
export default async function globalTeardown() {
  await cleanupE2eTestData();
}
