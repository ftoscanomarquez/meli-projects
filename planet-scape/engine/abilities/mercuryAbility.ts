import { TimedAbility, NEUTRAL_ABILITY_EFFECTS, type PlanetAbility } from "./types";

/**
 * Mercurio — ver AGENTS.md §5. Pasiva: inmunidad total a llamaradas.
 * Activa (6s, cooldown 30s): +250% velocidad (ajustado tras feedback real
 * del usuario, 2026-07-22 — antes +350%) + campo de 400px que ralentiza
 * asteroides 70%, con rastro de luz y parpadeo de los asteroides afectados
 * (ver GameEngine.ts `updateAbilityVisuals`/`updateFieldObjects`).
 */
export class MercuryAbility extends TimedAbility implements PlanetAbility {
  readonly invulnerable = false;
  readonly moonSpeedMultiplier = NEUTRAL_ABILITY_EFFECTS.moonSpeedMultiplier;
  readonly lavaBurstActive = false;
  readonly ringRepelActive = false;
  readonly pulsarSpawnBoost = 0;
  readonly redFlareImmune = false;
  readonly passiveSlowfieldRadius = 0;
  readonly passiveSlowfieldFactor = 1;
  readonly smallAsteroidImmune = false;

  // Valores por defecto = balance de lanzamiento; el admin los sobreescribe
  // vía game_config.abilities.mercury (duración/recarga, Fase 8) y
  // game_config.abilityParams.mercury (velocidad/campo/inmunidad, agregado
  // 2026-07-24 — pedido explícito del usuario: "no puedo modificar el
  // porcentaje de velocidad a la que corre mercurio... etc", ver AGENTS.md §9).
  constructor(
    durationMs = 6000,
    cooldownMs = 30000,
    readonly speedMultiplier = 3.5, // +250%
    readonly slowfieldRadius = 400,
    readonly slowfieldFactor = 0.3, // asteroides quedan al 30% de su velocidad (-70%)
    readonly flareImmune = true, // pasiva, siempre activa
  ) {
    super(durationMs, cooldownMs);
  }
}

/**
 * Planetas sin habilidad implementada todavía — en vez de fingir un efecto,
 * la acción no hace nada. Ver AGENTS.md §15 (Júpiter: multijugador, Fase 5;
 * Saturno: no seleccionable todavía, Fase 8).
 */
export class NoAbility implements PlanetAbility {
  phase: PlanetAbility["phase"] = "ready";
  activate() {
    return false;
  }
  update() {
    /* no-op */
  }
  get isActive() {
    return false;
  }
  get progress() {
    return 1;
  }
  flareImmune = NEUTRAL_ABILITY_EFFECTS.flareImmune;
  slowfieldRadius = NEUTRAL_ABILITY_EFFECTS.slowfieldRadius;
  slowfieldFactor = NEUTRAL_ABILITY_EFFECTS.slowfieldFactor;
  speedMultiplier = NEUTRAL_ABILITY_EFFECTS.speedMultiplier;
  invulnerable = NEUTRAL_ABILITY_EFFECTS.invulnerable;
  moonSpeedMultiplier = NEUTRAL_ABILITY_EFFECTS.moonSpeedMultiplier;
  lavaBurstActive = NEUTRAL_ABILITY_EFFECTS.lavaBurstActive;
  ringRepelActive = NEUTRAL_ABILITY_EFFECTS.ringRepelActive;
  pulsarSpawnBoost = NEUTRAL_ABILITY_EFFECTS.pulsarSpawnBoost;
  redFlareImmune = NEUTRAL_ABILITY_EFFECTS.redFlareImmune;
  passiveSlowfieldRadius = NEUTRAL_ABILITY_EFFECTS.passiveSlowfieldRadius;
  passiveSlowfieldFactor = NEUTRAL_ABILITY_EFFECTS.passiveSlowfieldFactor;
  smallAsteroidImmune = NEUTRAL_ABILITY_EFFECTS.smallAsteroidImmune;
}
