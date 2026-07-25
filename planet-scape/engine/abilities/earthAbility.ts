import { TimedAbility, type PlanetAbility } from "./types";

/**
 * Tierra — ver AGENTS.md §5. Activa (15s, cooldown 30s): Luna Hipervelocidad,
 * acelera la órbita de su luna x15 para destrozar amenazas. Pasiva SIEMPRE
 * activa agregada 2026-07-24 — pedido explícito del usuario: "su campo
 * magnetico... siempre lo protege de las llamaradas solares solo del sol
 * amarillo y cada vez que lo impactan aunque no le hacen nada provoca una
 * pequeña animacion de aurora boreal donde lo impacto" (la magnetosfera
 * real desvía el viento solar, y ESO es justo lo que causa la aurora
 * boreal en la vida real — ver `spawnAuroraBurst()` en GameEngine.ts).
 * Nunca protege contra el Sol Rojo, igual que la pasiva de Mercurio.
 */
export class EarthAbility extends TimedAbility implements PlanetAbility {
  readonly slowfieldRadius = 0;
  readonly slowfieldFactor = 1;
  readonly speedMultiplier = 1;
  readonly invulnerable = false;
  readonly lavaBurstActive = false;
  readonly ringRepelActive = false;
  readonly pulsarSpawnBoost = 0;
  readonly redFlareImmune = false;
  readonly passiveSlowfieldRadius = 0;
  readonly passiveSlowfieldFactor = 1;
  readonly smallAsteroidImmune = false;

  // Configurable por admin desde 2026-07-24 (game_config.abilityParams.earth,
  // ver AGENTS.md §9).
  constructor(
    durationMs = 15000,
    cooldownMs = 30000,
    readonly flareImmune = true, // campo magnético — pasiva, siempre activa
    private moonActiveSpeedMultiplier = 15,
  ) {
    super(durationMs, cooldownMs);
  }

  get moonSpeedMultiplier() {
    return this.isActive ? this.moonActiveSpeedMultiplier : 1; // siempre hay luna (>0); rápida solo mientras está activa
  }
}

export const EARTH_MOON_ORBIT_RADIUS = 62;
// La velocidad base (rad/s) ya no vive aquí — es configurable por admin,
// ver game_config.earthMoon.baseSpeed en engine/GameEngine.ts.
