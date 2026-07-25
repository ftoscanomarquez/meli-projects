import { NextRequest, NextResponse } from "next/server";
import { getSpaceFactText } from "@/lib/spaceFacts";
import { SPACE_FACT_COOKIE, pickNextFactKey } from "@/lib/spaceFacts.constants";
import type { AppLocale } from "@/i18n/routing";

/**
 * GET /api/space-facts/random — rotación del dato curioso en vivo mientras
 * el jugador sigue en la landing, sin recargar la página — pedido explícito
 * del usuario (2026-07-24): "todos esos mensaje tardan mucho en cambiar".
 * Antes solo cambiaba una vez por navegación completa (ver proxy.ts).
 * Reutiliza la misma cookie de "no repetir" (`sf_last`) para que la rotación
 * en vivo y la de recarga completa compartan el mismo historial de "último
 * mostrado" — nunca dos datos iguales seguidos, sin importar el mecanismo.
 */
export async function GET(request: NextRequest) {
  const locale = (request.nextUrl.searchParams.get("locale") === "en" ? "en" : "es") as AppLocale;
  const lastRaw = request.cookies.get(SPACE_FACT_COOKIE)?.value;
  const last = lastRaw !== undefined && !Number.isNaN(Number(lastRaw)) ? Number(lastRaw) : null;
  const nextKey = pickNextFactKey(last);
  const text = await getSpaceFactText(nextKey, locale);

  const response = NextResponse.json({ text });
  response.cookies.set(SPACE_FACT_COOKIE, String(nextKey), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
