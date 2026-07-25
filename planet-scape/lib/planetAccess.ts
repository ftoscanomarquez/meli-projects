import { isStarterPlanetKey, type PlanetKey } from "@/engine/characterSvg";

/**
 * Un jugador puede usar un planeta si es uno de los 4 iniciales (gratis) o
 * si ya lo compró con estrellas (`player.unlockedPlanets`, ver
 * lib/planetUnlocks.ts y app/api/planets/unlock/route.ts). Compartido por
 * /play y /lobby (Server Components) — defensa real, no solo de UI: un
 * jugador no puede jugar Júpiter/Saturno manipulando la URL sin haberlos
 * comprado.
 */
export function canPlayPlanet(planet: PlanetKey, unlockedPlanets: string[]): boolean {
  return isStarterPlanetKey(planet) || unlockedPlanets.includes(planet);
}
