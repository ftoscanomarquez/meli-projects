import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { checkRateLimit } from "./lib/resilience/rateLimit";
import { SPACE_FACT_COOKIE, SPACE_FACT_HEADER, pickNextFactKey } from "./lib/spaceFacts.constants";

// Rutas con límite estricto (ver INFRA.md §2 y AGENTS.md §12 regla 1).
// El resto de /api/* no lleva rate limit dedicado en Fase 0.
const RATE_LIMITED_ROUTES: Array<{ pattern: RegExp; limit: number }> = [
  { pattern: /^\/api\/auth\/signin$/, limit: 5 },
  // Código de 6 dígitos (2026-07-22, ver AGENTS.md §6.3): mucha menos entropía
  // que el token largo original — este límite (10/min/IP) hace inviable
  // adivinarlo por fuerza bruta dentro de la ventana de 10 min en que es válido.
  { pattern: /^\/api\/auth\/callback\/nodemailer$/, limit: 10 },
  { pattern: /^\/api\/donations\/checkout$/, limit: 10 },
  { pattern: /^\/api\/admin\//, limit: 60 },
  // Trazabilidad del cliente (ver app/api/client-log/route.ts) — generoso
  // porque errores reales pueden repetirse varias veces en poco tiempo,
  // pero limitado para que no sirva como vector de flood.
  { pattern: /^\/api\/client-log$/, limit: 40 },
];

// Solo la página de inicio de cada locale rota el dato curioso — ver
// AGENTS.md §1.1 / SPECIFICATION-SUMMARY.md §5.3 (resuelto server-side,
// nunca con Math.random() en cliente, para evitar mismatch de hidratación).
const HOME_PATH = /^\/(es|en)\/?$/;

const intlProxy = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const limited = RATE_LIMITED_ROUTES.find((r) => r.pattern.test(pathname));

    if (limited) {
      const identifier =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";
      const result = await checkRateLimit(`${pathname}:${identifier}`, limited.limit);

      if (!result.success) {
        return NextResponse.json(
          { error: "Demasiadas solicitudes, intenta de nuevo en unos minutos.", code: "RATE_LIMITED" },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      }
    }

    return NextResponse.next();
  }

  if (HOME_PATH.test(pathname)) {
    const lastRaw = request.cookies.get(SPACE_FACT_COOKIE)?.value;
    const last = lastRaw !== undefined && !Number.isNaN(Number(lastRaw)) ? Number(lastRaw) : null;
    const nextKey = pickNextFactKey(last);

    // Se fija ANTES de delegar a next-intl para que su respuesta (redirect o
    // next()) reenvíe este header al render — ver docs de proxy.ts de Next 16
    // ("To pass information from Proxy to your application, use headers...").
    request.headers.set(SPACE_FACT_HEADER, String(nextKey));

    const response = intlProxy(request);
    response.cookies.set(SPACE_FACT_COOKIE, String(nextKey), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  return intlProxy(request);
}

export const config = {
  matcher: [
    // Rutas de páginas para el enrutamiento de locale (excluye assets/_next)
    "/((?!_next|.*\\..*).*)",
    // Rutas de API con rate limiting
    "/api/:path*",
  ],
};
