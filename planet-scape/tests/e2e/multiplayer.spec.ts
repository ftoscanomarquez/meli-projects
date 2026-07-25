import { test, expect } from "@playwright/test";
import { loginViaMagicLink, uniqueTestEmail } from "./helpers/auth";

// Fase 5 / §8.1 — ver AGENTS.md. Requiere `npx partykit dev` corriendo
// (ver QUICK-START.md) además de `npm run dev`; si no está arriba, la
// conexión a la sala falla y este spec se cae con timeout al esperar el
// roster, no con un error confuso de red.
test("two real browsers: open-rooms directory, join, and the 'creating session' hand-off into the real engine", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const errorsA: string[] = [];
  const errorsB: string[] = [];
  pageA.on("pageerror", (e) => errorsA.push(e.message));
  pageB.on("pageerror", (e) => errorsB.push(e.message));

  await loginViaMagicLink(pageA, uniqueTestEmail("mp-a"));
  await loginViaMagicLink(pageB, uniqueTestEmail("mp-b"));

  await pageA.goto("/es/lobby?planet=mercury");
  await pageA.getByRole("button", { name: "Crear sala nueva" }).click();
  await pageA.waitForURL(/room=/);
  const roomId = new URL(pageA.url()).searchParams.get("room");
  expect(roomId).toBeTruthy();

  // B ve la sala abierta en vivo (sin recargar, sin polling) y se une.
  await pageB.goto("/es/lobby?planet=venus");
  await expect(pageB.getByText(String(roomId))).toBeVisible({ timeout: 10000 });
  await pageB.locator("li", { hasText: String(roomId) }).getByRole("button", { name: "Unirme" }).click();
  await pageB.waitForURL(new RegExp(`room=${roomId}`));
  await expect(pageB.getByText("Jugadores en la sala (2/4)")).toBeVisible({ timeout: 10000 });

  // A arranca manualmente — ambos deben pasar por "creando sesión" antes del canvas real.
  await pageA.getByRole("button", { name: "Iniciar ahora" }).click();
  await expect(pageA.getByText("Creando sesión del juego...")).toBeVisible({ timeout: 5000 });
  await expect(pageB.getByText("Creando sesión del juego...")).toBeVisible({ timeout: 5000 });

  await expect(pageA.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(pageB.locator("canvas")).toBeVisible({ timeout: 15000 });

  await pageA.waitForTimeout(2000);
  expect(errorsA, `Errores en A: ${errorsA.join("; ")}`).toHaveLength(0);
  expect(errorsB, `Errores en B: ${errorsB.join("; ")}`).toHaveLength(0);

  await ctxA.close();
  await ctxB.close();
});
