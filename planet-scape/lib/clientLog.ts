/**
 * Envía un evento al logger del servidor desde el navegador (ver
 * app/api/client-log/route.ts) — para diagnosticar bugs que solo ocurren en
 * el dispositivo de otro jugador (celular, etc.) donde no podemos ver la
 * consola directamente. Nunca debe romper la app si falla.
 */
export function clientLog(level: "info" | "warn" | "error", event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ level, event, data, url: window.location.href });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/client-log", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/client-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    // El logging nunca debe romper la app.
  }
}
