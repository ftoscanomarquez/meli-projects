import { test, expect } from "@playwright/test";
import { loginViaMagicLink, uniqueTestEmail } from "./helpers/auth";

// Fase 3/6 — ver AGENTS.md §4 y §7.2. El motor real (PixiJS) se monta en un
// navegador real; el guardado de partida se ejerce contra la misma ruta que
// usa GameEngine.reportSessionComplete(), con la sesión real ya autenticada.
test("single-player: engine mounts and runs without console errors, and a completed session persists stars/leaderboard", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const email = uniqueTestEmail("solo");
  await loginViaMagicLink(page, email);

  await page.goto("/es/play?planet=mercury");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15000 });

  // Deja correr el motor un rato real (spawns, física, paralaje) para que
  // cualquier error de runtime tenga oportunidad de aparecer.
  await page.waitForTimeout(6000);

  expect(errors, `Errores de consola durante el juego: ${errors.join("; ")}`).toHaveLength(0);

  // HUD inicial correcto (10 vidas, nivel 0) — ver AGENTS.md §5.1.
  await expect(page.getByText("♥ 10")).toBeVisible();

  // Ejerce el contrato real de persistencia (misma ruta que llama
  // GameEngine al terminar la partida) con la sesión real ya autenticada.
  const res = await page.request.post("/api/sessions/complete", {
    data: { planet: "mercury", level: 2, starsCollected: 5 },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.totalStars).toBe(5);
  expect(body.score).toBe(205); // level*100 + stars, ver lib/score.ts
  expect(body.leaderboardUpdated).toBe(true);

  // Una segunda partida con MENOS puntaje no debe pisar el mejor resultado.
  const res2 = await page.request.post("/api/sessions/complete", {
    data: { planet: "mercury", level: 0, starsCollected: 1 },
  });
  const body2 = await res2.json();
  expect(body2.totalStars).toBe(6); // las estrellas SÍ se acumulan siempre
  expect(body2.leaderboardUpdated).toBe(false); // pero el leaderboard no retrocede
});
