import { TimedAbility, NEUTRAL_ABILITY_EFFECTS, type PlanetAbility } from "./types";

/**
 * Marte — ver AGENTS.md §5. Activa (10s, cooldown 30s): ráfagas de lava en
 * 360° de corto alcance que desintegran asteroides cercanos.
 */
export class MarsAbility extends TimedAbility implements PlanetAbility {
  readonly flareImmune = false;
  readonly slowfieldRadius = 0;
  readonly slowfieldFactor = 1;
  readonly speedMultiplier = 1;
  readonly invulnerable = false;
  readonly moonSpeedMultiplier = NEUTRAL_ABILITY_EFFECTS.moonSpeedMultiplier;
  readonly ringRepelActive = false;
  readonly pulsarSpawnBoost = 0;
  readonly redFlareImmune = false;
  readonly passiveSlowfieldRadius = 0;
  readonly passiveSlowfieldFactor = 1;
  readonly smallAsteroidImmune = false;

  constructor(durationMs = 10000, cooldownMs = 30000) {
    super(durationMs, cooldownMs);
  }

  get lavaBurstActive() {
    return this.isActive;
  }
}

// "corto alcance" — ver AGENTS.md §5. Configurable por admin desde
// 2026-07-24 (game_config.abilityParams.mars.lavaRange, ver AGENTS.md §9) —
// GameEngine.ts lee el valor real de `gameConfig`, este export se queda
// solo como el valor de lanzamiento/fallback.
export const MARS_LAVA_RANGE = 130;
