import { execSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { loginViaMagicLink, uniqueTestEmail } from "./helpers/auth";

const REPO_ROOT = path.resolve(__dirname, "../..");

// Fase 8 — ver AGENTS.md §9. Cubre el gate de rol, la edición real de
// game_config, y que el cambio se refleje en una partida nueva sin
// redeploy — el criterio de salida explícito de la Fase 8.
test("admin panel: role gate, config edit reflected in a fresh game, and a player star adjustment", async ({ page }) => {
  const email = uniqueTestEmail("admin");
  await loginViaMagicLink(page, email);

  await page.goto("/es/admin");
  await expect(page.getByText("No autorizado")).toBeVisible();

  execSync(`npm run seed:admin -- --email="${email}"`, { cwd: REPO_ROOT, stdio: "pipe" });

  await page.goto("/es/admin");
  await expect(page.getByText("Panel de administración")).toBeVisible({ timeout: 10000 });

  await page.locator("#bh-min-clicks").fill("1");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("¡Guardado!", { exact: false })).toBeVisible({ timeout: 8000 });

  // Un jugador de prueba distinto, para el ajuste de estrellas.
  const targetEmail = uniqueTestEmail("admin-target");
  const targetPage = await page.context().browser()!.newPage();
  await loginViaMagicLink(targetPage, targetEmail);
  await targetPage.close();

  await page.getByPlaceholder("Buscar por correo...").fill(targetEmail.split("@")[0]);
  await page.getByRole("button", { name: "Buscar" }).click();
  const row = page.locator("li", { hasText: targetEmail });
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.getByPlaceholder("+/- estrellas").fill("42");
  await row.getByRole("button", { name: "Aplicar" }).click();
  await expect(row.getByText("⭐ 42 estrellas")).toBeVisible({ timeout: 8000 });

  // El criterio real de la Fase 8: una partida NUEVA ya usa el valor editado.
  await page.goto("/es/play?planet=mercury");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Derrota al agujero negro!.*1$/)).toBeVisible({ timeout: 25000 });

  // Deja el balance como lo encontró, para no afectar otras corridas/partidas manuales.
  await page.goto("/es/admin");
  await page.locator("#bh-min-clicks").fill("3");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("¡Guardado!", { exact: false })).toBeVisible({ timeout: 8000 });
});
