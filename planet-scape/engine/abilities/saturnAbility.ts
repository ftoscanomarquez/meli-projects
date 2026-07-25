import { TimedAbility, NEUTRAL_ABILITY_EFFECTS, type PlanetAbility } from "./types";

/**
 * Saturno — ver AGENTS.md §5. Activa (20s, cooldown 35s): anillos que
 * repelen asteroides cercanos (`ringRepelActive`, ver
 * GameEngine.updateFieldObjects) y, mientras dura, bloquean también las
 * llamaradas del Sol Rojo (`redFlareImmune`) — el único planeta con esa
 * defensa, pedido explícito del usuario (2026-07-22): "es el unico que
 * cuando su habilidad esta activa es el unico que tiene defensa del sol
 * rojo". Pasiva siempre activa (no depende de `isActive`): probabilidad de
 * aparición de pulsares curativos aumentada — +30% en solitario, o el
 * doble (+50%, la fórmula de GameEngine.updateSpawns reduce el intervalo a
 * la mitad) en multijugador, pedido explícito del usuario (2026-07-22):
 * "cuando esta en equipo... que duplique la aparicion de pulsares
 * curativos pero solo cuando esta en equipo, cuando juega solo ahi solo
 * incrementa un 30%" (antes era un +15% fijo sin importar el modo).
 */
export class SaturnAbility extends TimedAbility implements PlanetAbility {
  readonly flareImmune = false;
  readonly slowfieldRadius = 0;
  readonly slowfieldFactor = 1;
  readonly speedMultiplier = 1;
  readonly invulnerable = false;
  readonly moonSpeedMultiplier = NEUTRAL_ABILITY_EFFECTS.moonSpeedMultiplier;
  readonly lavaBurstActive = false;
  readonly pulsarSpawnBoost: number;
  readonly passiveSlowfieldRadius = 0;
  readonly passiveSlowfieldFactor = 1;
  readonly smallAsteroidImmune = false;

  // `pulsarBoostSolo`/`pulsarBoostTeam`/`redFlareImmuneEnabled` configurables
  // por admin desde 2026-07-24 (game_config.abilityParams.saturn, ver
  // AGENTS.md §9) — antes 0.3/0.5 fijos y la inmunidad al Sol Rojo siempre
  // encendida mientras la habilidad está activa.
  constructor(
    durationMs = 20000,
    cooldownMs = 35000,
    inMultiplayer = false,
    pulsarBoostSolo = 0.3,
    pulsarBoostTeam = 0.5,
    private redFlareImmuneEnabled = true,
  ) {
    super(durationMs, cooldownMs);
    this.pulsarSpawnBoost = inMultiplayer ? pulsarBoostTeam : pulsarBoostSolo;
  }

  get ringRepelActive() {
    return this.isActive;
  }

  get redFlareImmune() {
    return this.redFlareImmuneEnabled && this.isActive;
  }
}
