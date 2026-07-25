/**
 * `new URL(request.url).origin` en Next.js 16 dev (Turbopack) siempre
 * resuelve a `http://localhost:<puerto>`, sin importar el host real que el
 * cliente usó para conectarse — confirmado con logs reales: `request.url`
 * mostraba `localhost:3000` mientras los headers `host`/`x-forwarded-host`
 * sí traían la IP de red real (192.168.x.x) del celular. Esto rompía la
 * redirección de vuelta de Stripe Checkout (`success_url`/`cancel_url`)
 * cuando se pagaba desde el celular — bug real reportado por el usuario
 * (2026-07-22), ver RETROSPECTIVA.md. Los headers `host`/`x-forwarded-host`
 * sí reflejan la conexión real y son la fuente correcta.
 */
export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${protocol}://${host}` : new URL(request.url).origin;
}
