/**
 * Contrato compartido por todas las habilidades — ver AGENTS.md §5. Cada
 * planeta solo usa los campos de efecto que le aplican; el resto queda en
 * su valor neutro. Esto evita que GameEngine tenga que castear/ramificar
 * por planeta en cada chequeo de colisión.
 */
export type AbilityPhase = "ready" | "active" | "cooldown";

export interface PlanetAbility {
  phase: AbilityPhase;
  activate(): boolean;
  update(deltaMS: number): void;
  readonly isActive: boolean;
  readonly progress: number;

  // Mercurio
  flareImmune: boolean;
  slowfieldRadius: number;
  slowfieldFactor: number;
  speedMultiplier: number;
  // Venus
  invulnerable: boolean;
  // Tierra — 1 = luna a velocidad normal, 15 = hipervelocidad activa
  moonSpeedMultiplier: number;
  // Marte
  lavaBurstActive: boolean;
  // Saturno
  ringRepelActive: boolean;
  pulsarSpawnBoost: number;
  // Único planeta que bloquea llamaradas del Sol Rojo, y solo mientras su
  // habilidad activa está encendida — pedido explícito del usuario
  // (2026-07-22): "es el unico que cuando su habilidad esta activa es el
  // unico que tiene defensa del sol rojo". Ver GameEngine.ts#checkCollisions.
  redFlareImmune: boolean;
  // Neptuno — "Aura Helada", pasiva SIEMPRE activa (a diferencia de
  // `slowfieldRadius`/`slowfieldFactor` de arriba, que Mercurio/Neptuno
  // reutilizan para su respectiva habilidad ACTIVA, gateada por
  // `isActive`). Radio pequeño, efecto leve — ver AGENTS.md §5 y
  // engine/abilities/neptuneAbility.ts.
  passiveSlowfieldRadius: number;
  passiveSlowfieldFactor: number;
  // Venus — pasiva SIEMPRE activa (2026-07-24, pedido explícito del
  // usuario): "los asteroides pequeños que se acerquen a venus cambian a un
  // color rojo como si se quemaran y al chocar con venus se vuelven polvo...
  // pero los asteroides pequeños nunca le hacen nada a Venus" — su
  // atmósfera densa/caliente los quema, igual que el atmósfera real de la
  // Tierra desintegra meteoritos pequeños. Solo aplica a asteroides chicos
  // (ver SMALL_ASTEROID_RADIUS en GameEngine.ts); los grandes siguen
  // dañándolo normalmente sin el escudo activo.
  smallAsteroidImmune: boolean;
}

export const NEUTRAL_ABILITY_EFFECTS = {
  flareImmune: false,
  slowfieldRadius: 0,
  slowfieldFactor: 1,
  speedMultiplier: 1,
  invulnerable: false,
  moonSpeedMultiplier: 0, // 0 = sin luna (solo Tierra tiene)
  lavaBurstActive: false,
  ringRepelActive: false,
  pulsarSpawnBoost: 0,
  redFlareImmune: false,
  passiveSlowfieldRadius: 0,
  passiveSlowfieldFactor: 1,
  smallAsteroidImmune: false,
} as const;

/** Base para habilidades activadas por temporizador (duración + cooldown). */
export abstract class TimedAbility {
  phase: AbilityPhase = "ready";
  protected elapsed = 0;

  constructor(
    private durationMs: number,
    private cooldownMs: number,
  ) {}

  activate(): boolean {
    if (this.phase !== "ready") return false;
    this.phase = "active";
    this.elapsed = 0;
    return true;
  }

  update(deltaMS: number) {
    this.elapsed += deltaMS;
    if (this.phase === "active" && this.elapsed >= this.durationMs) {
      this.phase = "cooldown";
      this.elapsed = 0;
    } else if (this.phase === "cooldown" && this.elapsed >= this.cooldownMs) {
      this.phase = "ready";
      this.elapsed = 0;
    }
  }

  get isActive() {
    return this.phase === "active";
  }

  get progress(): number {
    if (this.phase === "active") return 1 - this.elapsed / this.durationMs;
    if (this.phase === "cooldown") return 1 - this.elapsed / this.cooldownMs;
    return 1;
  }
}
