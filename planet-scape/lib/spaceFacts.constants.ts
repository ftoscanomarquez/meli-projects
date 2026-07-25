// Compartido entre proxy.ts y app/[locale]/page.tsx — ver
// SPECIFICATION-SUMMARY.md §5.3 y scripts/seeds/seed-config.ts.
export const SPACE_FACTS_COUNT = 100;
export const SPACE_FACT_COOKIE = "sf_last";
export const SPACE_FACT_HEADER = "x-space-fact-key";

/**
 * Elige el siguiente dato curioso sin repetir el último mostrado. Vive aquí
 * (sin dependencias, en vez de en lib/spaceFacts.ts) a propósito: ese otro
 * archivo importa `lib/db.ts` (Mongo), y `proxy.ts` no debe cargar el driver
 * de Mongo en su bundle. Usado por `proxy.ts` (primer dato al cargar la
 * landing) y `app/api/space-facts/random/route.ts` (rotación cliente cada
 * ~10s, agregada 2026-07-24 — el dato antes solo cambiaba al recargar la
 * página completa: "esos mensajes tardan mucho en cambiar").
 */
export function pickNextFactKey(lastShown: number | null): number {
  if (SPACE_FACTS_COUNT <= 1) return 0;
  let next = Math.floor(Math.random() * SPACE_FACTS_COUNT);
  while (next === lastShown) {
    next = Math.floor(Math.random() * SPACE_FACTS_COUNT);
  }
  return next;
}
