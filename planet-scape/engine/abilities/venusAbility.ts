import { TimedAbility, NEUTRAL_ABILITY_EFFECTS, type PlanetAbility } from "./types";

/**
 * Venus — ver AGENTS.md §5. Activa (10s, cooldown 30s): escudo de gas ácido,
 * invulnerabilidad total mientras dura. Pasiva SIEMPRE activa agregada
 * 2026-07-24 — pedido explícito del usuario: "los asteroides pequeños que
 * se acerquen a venus cambian a un color rojo como si se quemaran y al
 * chocar con venus se vuelven polvo... pero los asteroides pequeños nunca
 * le hacen nada a Venus" (su atmósfera densa/calientísima los desintegra,
 * igual que la atmósfera terrestre desintegra meteoritos pequeños — ver
 * `smallAsteroidImmune` en GameEngine.ts).
 */
export class VenusAbility extends TimedAbility implements PlanetAbility {
  readonly flareImmune = false;
  readonly slowfieldRadius = 0;
  readonly slowfieldFactor = 1;
  readonly speedMultiplier = 1;
  readonly moonSpeedMultiplier = NEUTRAL_ABILITY_EFFECTS.moonSpeedMultiplier;
  readonly lavaBurstActive = false;
  readonly ringRepelActive = false;
  readonly pulsarSpawnBoost = 0;
  readonly redFlareImmune = false;
  readonly passiveSlowfieldRadius = 0;
  readonly passiveSlowfieldFactor = 1;

  // Configurable por admin desde 2026-07-24 (game_config.abilityParams.venus,
  // ver AGENTS.md §9).
  constructor(durationMs = 10000, cooldownMs = 30000, readonly smallAsteroidImmune = true) {
    super(durationMs, cooldownMs);
  }

  get invulnerable() {
    return this.isActive;
  }
}
