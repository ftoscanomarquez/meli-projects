import { TimedAbility, NEUTRAL_ABILITY_EFFECTS, type PlanetAbility } from "./types";

/**
 * Júpiter — ver AGENTS.md §5. En solitario (1 jugador) la habilidad activa
 * el escudo solo para sí mismo (invulnerabilidad, igual patrón que Venus),
 * sin bonos. En multijugador, el bono de "proteger compañero" (+3 vidas al
 * protegido, +2 estrellas a Júpiter, escudo mutuo) se calcula en
 * `GameEngine.ts#tryShieldNearestAlly()` — esta clase solo controla el
 * temporizador/fase de la habilidad en sí; el targeting de compañero
 * cercano vive en el motor porque necesita las posiciones de los jugadores
 * remotos, que esta clase no conoce.
 */
export class JupiterAbility extends TimedAbility implements PlanetAbility {
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
  readonly smallAsteroidImmune = false;

  constructor(durationMs = 20000, cooldownMs = 35000) {
    super(durationMs, cooldownMs);
  }

  get invulnerable() {
    return this.isActive;
  }
}
