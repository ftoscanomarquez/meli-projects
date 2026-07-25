/**
 * Solo para pruebas locales — ver AGENTS.md §6 y feedback del usuario
 * (2026-07-22): "que te pida el correo pero que te deje entrar de inmediato
 * sin el Magic Link". En vez de un mecanismo de auth paralelo/falso, esto
 * reutiliza el flujo REAL de Auth.js (el correo se envía de verdad a
 * Mailpit) y solo automatiza del lado del servidor el paso de "revisar el
 * correo y hacer clic" — la sesión que se crea es una sesión real, no una
 * simulada. Gateado por `DEV_AUTO_LOGIN` (ver lib/actions/auth.ts) y
 * además protegido aquí por `NODE_ENV !== "production"` como segundo
 * seguro — nunca debe activarse en producción (Mailpit ni siquiera existe
 * ahí, ver AGENTS.md §6.1).
 */
export async function pollMailpitForMagicLink(email: string): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("pollMailpitForMagicLink nunca debe llamarse en producción");
  }

  const mailpitUrl = process.env.MAILPIT_UI_URL ?? "http://localhost:8025";
  // Mismas credenciales que la UI de Mailpit (ver QUICK-START.md) — la API
  // vive detrás del mismo Basic Auth. Sin esto Mailpit responde
  // "Unauthorized." en texto plano y el primer intento real falló así.
  const auth = "Basic " + Buffer.from(`${process.env.EMAIL_SERVER_USER}:${process.env.EMAIL_SERVER_PASSWORD}`).toString("base64");
  const headers = { Authorization: auth };

  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${mailpitUrl}/api/v1/messages?limit=20`, { cache: "no-store", headers });
    const data = (await res.json()) as { messages?: { ID: string; To?: { Address: string }[] }[] };
    const msg = data.messages?.find((m) => m.To?.some((t) => t.Address === email));
    if (msg) {
      const detailRes = await fetch(`${mailpitUrl}/api/v1/message/${msg.ID}`, { cache: "no-store", headers });
      const detail = (await detailRes.json()) as { HTML: string };
      const match = detail.HTML.match(/href="([^"]*api\/auth\/callback\/nodemailer[^"]*)"/);
      if (match) return match[1].replace(/&amp;/g, "&").replace(/&#x3D;/g, "=");
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  throw new Error(`No se encontró el Magic Link para ${email} en Mailpit (DEV_AUTO_LOGIN)`);
}
