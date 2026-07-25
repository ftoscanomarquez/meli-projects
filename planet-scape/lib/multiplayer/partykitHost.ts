/**
 * Bug real reportado por el usuario (2026-07-22, ver RETROSPECTIVA.md):
 * `NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999` queda fijo en el bundle del
 * cliente en build time. Desde un celular en la misma red, "localhost"
 * resuelve al propio celular, no a la PC que corre PartyKit — la conexión
 * de sala nunca se establecía, así que el jugador nunca aparecía en su
 * propio roster ("Jugadores en la sala (0/4)").
 *
 * En desarrollo, se deriva el host real en tiempo de ejecución a partir de
 * `window.location.hostname` (el mismo host que sirvió la página, sea
 * `localhost` en la PC o `192.168.x.x` desde el celular), preservando el
 * puerto configurado. En producción (`NEXT_PUBLIC_PARTYKIT_HOST` apunta a
 * un dominio real de partykit.dev, no a "localhost"), se usa tal cual.
 */
export function getPartyKitHost(): string {
  const configured = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

  if (typeof window === "undefined" || !configured.startsWith("localhost")) {
    return configured;
  }

  const port = configured.split(":")[1] ?? "1999";
  return `${window.location.hostname}:${port}`;
}
