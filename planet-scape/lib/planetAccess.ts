import { isStarterPlanetKey, type PlanetKey } from "@/engine/characterSvg";

/**
 * Un jugador puede usar un planeta si HAY SESIÓN, y además es uno de los 4
 * iniciales (gratis) o ya lo compró con estrellas
 * (`player.unlockedPlanets`, ver lib/planetUnlocks.ts y
 * app/api/planets/unlock/route.ts). Compartido por /play y /lobby (Server
 * Components) — defensa real, no solo de UI: un jugador no puede jugar
 * manipulando la URL sin haber iniciado sesión (2026-07-26, pedido
 * explícito del usuario: "aunque sean los 4 gratis, para poder jugar
 * necesitas haberte registrado, eso no hay de otra"), ni Júpiter/Saturno
 * sin haberlos comprado.
 */
export function canPlayPlanet(planet: PlanetKey, hasSession: boolean, unlockedPlanets: string[]): boolean {
  if (!hasSession) return false;
  return isStarterPlanetKey(planet) || unlockedPlanets.includes(planet);
}
