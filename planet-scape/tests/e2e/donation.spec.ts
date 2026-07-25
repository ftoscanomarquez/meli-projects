import { test, expect } from "@playwright/test";
import { loginViaMagicLink, uniqueTestEmail } from "./helpers/auth";

// Fase 7/8 — ver AGENTS.md §10. Cubre hasta la Checkout Session real de
// Stripe (creación + redirección real, monto correcto en centavos). NO
// completa el pago con tarjeta de prueba aquí: eso requiere `stripe listen`
// corriendo en paralelo para que el webhook acredite las estrellas, y ya
// quedó validado manualmente de principio a fin (ver RETROSPECTIVA.md,
// Fase 7) — automatizarlo como parte de esta suite añadiría una dependencia
// de infraestructura extra sin aportar cobertura nueva sobre lo ya probado.
test("donation checkout creates a real Stripe Checkout Session for the exact slider amount", async ({ page }) => {
  const email = uniqueTestEmail("donation");
  await loginViaMagicLink(page, email);

  const res = await page.request.post("/api/donations/checkout", {
    data: { amountCents: 15000 }, // $150 MXN — un valor intermedio real de la barra
  });
  expect(res.ok()).toBe(true);
  const { url } = await res.json();
  expect(url).toContain("checkout.stripe.com");

  await page.goto(url);
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
  // Confirma que Stripe realmente registró el monto exacto pedido, no uno redondeado.
  await expect(page.getByText("$150.00")).toBeVisible({ timeout: 15000 });
});

test("donation checkout rejects an amount outside game_config.donation's range", async ({ page }) => {
  const email = uniqueTestEmail("donation-oob");
  await loginViaMagicLink(page, email);

  const res = await page.request.post("/api/donations/checkout", {
    data: { amountCents: 1 }, // muy por debajo del mínimo configurado ($100 MXN de lanzamiento)
  });
  expect(res.status()).toBe(400);
});
