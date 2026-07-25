"use server";

import { signIn, signOut } from "@/lib/auth";
import { pollMailpitForMagicLink } from "@/lib/dev/mailpitAutoLogin";
import type { AppLocale } from "@/i18n/routing";

/**
 * `DEV_AUTO_LOGIN=true` (solo `.env.local`, nunca en producción — ver
 * lib/dev/mailpitAutoLogin.ts) hace que este formulario entre de inmediato
 * en vez de mandar al jugador a revisar Mailpit — pedido explícito del
 * usuario (2026-07-22) para poder probar desde el celular sin acceso a la
 * bandeja de Mailpit del navegador de escritorio. Sigue siendo el flujo
 * REAL de Auth.js (el correo se manda de verdad); solo se automatiza el
 * "revisar el correo y hacer clic" del lado del servidor.
 *
 * En modo normal (sin DEV_AUTO_LOGIN) ya no se deja que Auth.js redirija
 * solo a su pantalla "revisa tu correo" por defecto — se usa `redirect:
 * false` siempre, para que `AuthStatus.tsx` pueda mostrar su propio paso de
 * "ingresa el código de 6 dígitos" (ver `lib/auth.ts`, código en vez de
 * token largo, pedido explícito del usuario 2026-07-22 — AGENTS.md §6.3).
 */
export async function requestMagicLink(
  locale: AppLocale,
  formData: FormData,
): Promise<{ devAutoLoginUrl: string } | { codeSent: true }> {
  const email = String(formData.get("email") ?? "");

  if (process.env.DEV_AUTO_LOGIN === "true" && process.env.NODE_ENV !== "production") {
    await signIn("nodemailer", { email, redirect: false, redirectTo: `/${locale}` });
    const devAutoLoginUrl = await pollMailpitForMagicLink(email);
    return { devAutoLoginUrl };
  }

  await signIn("nodemailer", {
    email,
    redirect: false,
    redirectTo: `/${locale}`,
  });
  return { codeSent: true };
}

/**
 * Sin `redirect` propio a propósito — ver AuthStatus.tsx. Verificado con
 * Playwright: `signOut({ redirect: false })` sí borra la sesión en el
 * servidor de inmediato (GET /api/auth/session -> null), pero si esta
 * Server Action redirige ella misma (con `redirect()` de Next.js, incluso
 * junto con `revalidatePath`), el cliente reutiliza el Router Cache de la
 * página destino y el usuario sigue viendo la sesión anterior hasta que
 * hace un reload manual — un bug real reportado por el usuario (2026-07-22),
 * ver RETROSPECTIVA.md. La navegación dura la hace el cliente
 * (`window.location.href`), que ignora ese caché por completo.
 */
export async function signOutAction() {
  await signOut({ redirect: false });
}
