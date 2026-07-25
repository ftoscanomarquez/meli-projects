import type { Page } from "@playwright/test";

/**
 * Helpers de autenticación real vía Mailpit — ver AGENTS.md §6 y §11.
 * Nunca se simula el login: se manda el Magic Link real, se lee de la API
 * de Mailpit, y se navega al link real de callback de Auth.js.
 */
const MAILPIT_API = "http://localhost:8025/api/v1";
const MAILPIT_AUTH = "Basic " + Buffer.from("admin:magiclink123").toString("base64");

export function uniqueTestEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function getMagicLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT_API}/messages?limit=20`, { headers: { Authorization: MAILPIT_AUTH } });
    const data = await res.json();
    const msg = data.messages?.find((m: { To?: { Address: string }[] }) => m.To?.some((t) => t.Address === email));
    if (msg) {
      const detail = await (
        await fetch(`${MAILPIT_API}/message/${msg.ID}`, { headers: { Authorization: MAILPIT_AUTH } })
      ).json();
      const match = detail.HTML.match(/href="([^"]*api\/auth\/callback\/nodemailer[^"]*)"/);
      if (match) return match[1].replace(/&amp;/g, "&").replace(/&#x3D;/g, "=");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No se encontró el correo de Magic Link para ${email}`);
}

export async function loginViaMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/es");
  await page.getByLabel("Tu correo").fill(email);
  await page.getByRole("button", { name: "Entrar con Magic Link" }).click();
  const link = await getMagicLink(email);
  await page.goto(link);
  await page.waitForURL("**/es**", { timeout: 15000 });
}
