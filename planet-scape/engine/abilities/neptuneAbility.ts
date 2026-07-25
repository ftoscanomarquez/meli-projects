import { TimedAbility, NEUTRAL_ABILITY_EFFECTS, type PlanetAbility } from "./types";

/**
 * Neptuno — gigante de hielo, el planeta premium más caro (3500 ⭐, ver
 * AGENTS.md §5/§9) — pedido explícito del usuario (2026-07-23): "es el de
 * los mas caros... por lo que sus habilidades individuales y en salas deben
 * ser muy buenas". Pasiva SIEMPRE activa ("Aura Helada"): radio pequeño
 * (140px) que ralentiza levemente los asteroides cercanos, sin gastar nada
 * — reutiliza `passiveSlowfieldRadius`/`passiveSlowfieldFactor` (nuevo en
 * PlanetAbility, ver types.ts), independiente de `isActive`.
 *
 * Activa (12s, cooldown 40s) — "Tormenta de Neptuno": congela casi por
 * completo los asteroides dentro de un radio grande (260px, `slowfieldRadius`
 * al 8% de su velocidad — mucho más fuerte que el 30% de Mercurio) y
 * cualquiera que lo toque se hace añicos sin hacer daño (ver
 * GameEngine.ts#checkCollisions, mismo mecanismo que Mercurio a
 * súper-velocidad, generalizado a ambos planetas). **Efecto de equipo**
 * (lo que justifica el precio, ver AGENTS.md §8.2): mientras está activa,
 * la tormenta se siente en TODA la sala, no solo cerca de Neptuno — cada
 * cliente ya sabe si hay un Neptuno con la habilidad activa en el roster
 * (reutiliza `abilityState`, ya sincronizado para el indicador de habilidad
 * — sin ningún mensaje de red nuevo) y se aplica una versión más leve del
 * congelamiento alrededor de CADA jugador, sin importar la distancia real a
 * Neptuno.
 */
export class NeptuneAbility extends TimedAbility implements PlanetAbility {
  readonly flareImmune = false;
  readonly speedMultiplier = 1; // el poder de Neptuno es controlar el campo, no la velocidad propia
  readonly invulnerable = false;
  readonly moonSpeedMultiplier = NEUTRAL_ABILITY_EFFECTS.moonSpeedMultiplier;
  readonly lavaBurstActive = false;
  readonly ringRepelActive = false;
  readonly pulsarSpawnBoost = 0;
  readonly redFlareImmune = false;
  readonly smallAsteroidImmune = false;

  // Los 4 radios/factores de congelamiento (Tormenta activa + Aura Helada
  // pasiva) son configurables por admin desde 2026-07-24
  // (game_config.abilityParams.neptune, ver AGENTS.md §9) — el ajuste de
  // `passiveSlowfieldFactor` de 0.75→0.5 del mismo día (pedido explícito del
  // usuario: "que disminuya mas la velocidad de los asteroides... que sea
  // un poco mas perseptible pero que no los detenga por completo") ya vive
  // en el valor por defecto de abajo, no aquí.
  constructor(
    durationMs = 12000,
    cooldownMs = 40000,
    readonly slowfieldRadius = 260,
    readonly slowfieldFactor = 0.08, // congelamiento casi total mientras está activa
    readonly passiveSlowfieldRadius = 140,
    readonly passiveSlowfieldFactor = 0.5,
  ) {
    super(durationMs, cooldownMs);
  }
}
