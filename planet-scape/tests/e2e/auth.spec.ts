import { test, expect } from "@playwright/test";
import { loginViaMagicLink, uniqueTestEmail } from "./helpers/auth";

// Fase 1 — ver AGENTS.md §6. Contra Mailpit real, nunca simulado.
test("magic link login creates a session and a new player profile", async ({ page }) => {
  const email = uniqueTestEmail("auth");

  await loginViaMagicLink(page, email);

  // El widget de sesión (AuthStatus) debe reflejar que ya hay sesión activa.
  await expect(page.getByText("0 ⭐")).toBeVisible({ timeout: 10000 });
});
