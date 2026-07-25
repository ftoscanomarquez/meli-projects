import { Container, Graphics } from "pixi.js";
import type { Rng } from "../rng";

/**
 * Ver AGENTS.md §5.1: aviso (enana azul neón, 3s) -> fase activa, atracción
 * + "devora" asteroides -> derrota a clics (3 en nivel 0, hasta 20 en
 * niveles altos). Ajuste de feedback real del usuario (2026-07-22): la fase
 * activa YA NO expira sola — se queda hasta que el jugador la derrote a
 * clics, y cuanto más tiempo pasa sin derrotarla, más grande y fuerte se
 * pone (radio, atracción y el jalón sobre el jugador/asteroides, que se
 * calculan a partir de `radius`/`attractionForce`, crecen juntos).
 */
export type BlackHolePhase = "hidden" | "warning" | "active" | "defeated";

// "nova" — segundo agujero negro, nivel 60+ (ver AGENTS.md §5.1). Pedido
// explícito del usuario (2026-07-22): visual "más bonito y vistoso"
// inspirado en un disco de acreción real (referencia visual provista por
// el usuario, recreada aquí con PixiJS Graphics — nunca la imagen en sí,
// ver AGENTS.md §4 "no hay imágenes que almacenar"), que brilla y
// parpadea, y cuyo efecto propio es TRIPLICAR la frecuencia de aparición
// de asteroides mientras está activo. Se derrota exactamente igual que el
// clásico (misma mecánica de clics).
export type BlackHoleVariant = "classic" | "nova";

export type BlackHoleConfig = {
  size: number;
  attractionForce: number;
  minClicksToDefeat: number;
  maxClicksToDefeat: number;
};
const DEFAULT_BLACK_HOLE_CONFIG: BlackHoleConfig = {
  size: 46,
  attractionForce: 1,
  minClicksToDefeat: 3,
  maxClicksToDefeat: 20,
};

const WARNING_MS = 3000;
const DEFEATED_MS = 350;
// Techo del crecimiento mientras sigue activa: +80% de tamaño y hasta 3x de
// atracción tras ~20s sin ser derrotada — sigue siendo posible escapar/
// derrotarla, no crece sin límite.
const MAX_GROWTH_SCALE = 1.8;
const MAX_ATTRACTION_MULTIPLIER = 3;
const GROWTH_RAMP_MS = 20000;

export class BlackHole {
  readonly container: Container;
  private warningStar: Graphics;
  private core: Graphics;
  private ring: Container;
  phase: BlackHolePhase = "hidden";
  x = 0;
  y = 0;
  private baseRadius: number;
  // Crece con el tiempo en fase activa — ver AGENTS.md §5.1 y MAX_GROWTH_SCALE.
  private growthScale = 1;
  clicksRequired = 3;
  clicksRemaining = 3;

  private elapsed = 0;
  private hiddenDuration = 5000;

  // Targeting FIFO entre dos agujeros negros simultáneos (ver AGENTS.md
  // §5.1 y GameEngine.ts): "si aparecen 2 agujeros negros, cada clic
  // primero afecta al que haya aparecido primero". `activationOrder` se
  // asigna desde afuera (GameEngine, con un contador compartido) la primera
  // vez que `takeJustActivated()` devuelve `true` tras cada activación.
  activationOrder = Infinity;
  private justActivatedFlag = false;

  constructor(
    private width: number,
    private height: number,
    private rng: Rng,
    private blackHoleConfig: BlackHoleConfig = DEFAULT_BLACK_HOLE_CONFIG,
    private variant: BlackHoleVariant = "classic",
  ) {
    this.baseRadius = blackHoleConfig.size;
    this.container = new Container();
    this.container.visible = false;

    this.warningStar = new Graphics().star(0, 0, 4, 14, 5).fill(variant === "nova" ? 0xbfe8ff : 0x7ce0ff);

    this.ring = variant === "nova" ? this.buildNovaDisk() : this.buildClassicRing();
    this.core = new Graphics().circle(0, 0, this.baseRadius * (variant === "nova" ? 0.82 : 1)).fill(0x030109);

    this.container.addChild(this.ring, this.core, this.warningStar);
    this.core.visible = false;
    this.ring.visible = false;
    this.warningStar.visible = false;
  }

  /** Agujero negro clásico (nivel 0+) — anillos morado/magenta rotando, ver AGENTS.md §5.1. */
  private buildClassicRing(): Container {
    const ring = new Container();
    for (let i = 0; i < 3; i++) {
      const arc = new Graphics()
        .circle(0, 0, this.baseRadius + 10 + i * 12)
        .stroke({ width: 5, color: i % 2 === 0 ? 0xb35cff : 0xff5ccb, alpha: 0.5 });
      ring.addChild(arc);
    }
    return ring;
  }

  /**
   * Disco de acreción del Agujero Negro Nova (nivel 60+, ver AGENTS.md
   * §5.1) — recreado con PixiJS Graphics a partir de la referencia visual
   * que dio el usuario (un disco de acreción real fotorrealista, azul-
   * blanco brillante, en un plano inclinado con el anillo de luz curvado
   * por lente gravitacional alrededor del horizonte de eventos oscuro).
   * Nunca se usa la imagen en sí (ver AGENTS.md §4: "no hay imágenes que
   * almacenar") — es 100% procedural, igual que el resto de entidades del
   * juego. Varias elipses concéntricas inclinadas, degradado azul-blanco
   * simulado por capas (Graphics no soporta radial gradient nativo aquí, ver
   * `drawNebula`/`drawSpiralGalaxy` en parallaxSystem.ts para el mismo
   * truco), más un anillo delgado y muy brillante pegado al horizonte para
   * el efecto de "lente gravitacional". `disk` se guarda aparte de `ring`
   * (mismo Container, ver campo `ring`) para poder rotarlo con la
   * inclinación fija sin afectar el resto.
   */
  private buildNovaDisk(): Container {
    const disk = new Container();
    disk.rotation = -0.32; // inclinación fija del plano del disco

    // Capas exteriores → interiores, de más tenue/violeta a más brillante/blanco.
    const layers: { rx: number; ry: number; color: number; alpha: number; width: number }[] = [
      { rx: this.baseRadius * 2.6, ry: this.baseRadius * 0.85, color: 0x2a3f8f, alpha: 0.35, width: 10 },
      { rx: this.baseRadius * 2.15, ry: this.baseRadius * 0.68, color: 0x4d6fd9, alpha: 0.45, width: 9 },
      { rx: this.baseRadius * 1.7, ry: this.baseRadius * 0.5, color: 0x7ab8ff, alpha: 0.55, width: 8 },
      { rx: this.baseRadius * 1.3, ry: this.baseRadius * 0.35, color: 0xbfe0ff, alpha: 0.75, width: 7 },
    ];
    for (const l of layers) {
      const arc = new Graphics().ellipse(0, 0, l.rx, l.ry).stroke({ width: l.width, color: l.color, alpha: l.alpha });
      disk.addChild(arc);
    }
    // Anillo de lente gravitacional — muy delgado y muy brillante, pegado al
    // borde del horizonte de eventos (se dibuja aparte, no rotado con el
    // resto del disco, para que quede como un aro parejo alrededor del
    // núcleo sin importar la inclinación del disco).
    const lensing = new Graphics().circle(0, 0, this.baseRadius * 1.04).stroke({ width: 4, color: 0xf3fbff, alpha: 0.95 });

    const container = new Container();
    container.addChild(disk, lensing);
    return container;
  }

  private scheduleHidden() {
    this.phase = "hidden";
    this.elapsed = 0;
    this.hiddenDuration = 8000 + this.rng() * 9000;
    this.container.visible = false;
  }

  private spawnWarning() {
    this.x = this.width * (0.18 + this.rng() * 0.64);
    this.y = this.height * (0.18 + this.rng() * 0.6);
    this.container.position.set(this.x, this.y);
    this.container.visible = true;
    this.warningStar.visible = true;
    this.core.visible = false;
    this.ring.visible = false;
    this.core.scale.set(1);
    this.ring.scale.set(1);
    this.phase = "warning";
    this.elapsed = 0;
  }

  private activate(level: number) {
    this.phase = "active";
    this.elapsed = 0;
    this.growthScale = 1;
    this.warningStar.visible = false;
    this.core.visible = true;
    this.ring.visible = true;
    this.ring.alpha = 1;
    // Marca para GameEngine (ver `takeJustActivated()`): recién activado,
    // debe entrar en la cola de prioridad de targeting FIFO.
    this.justActivatedFlag = true;
    // Rango configurable por admin (game_config.blackHole) — ver AGENTS.md §5.1/§9.
    const { minClicksToDefeat, maxClicksToDefeat } = this.blackHoleConfig;
    this.clicksRequired = Math.min(maxClicksToDefeat, minClicksToDefeat + Math.floor(level * 1.4));
    this.clicksRemaining = this.clicksRequired;
  }

  /**
   * Consumido por GameEngine una sola vez por activación, para asignar
   * `activationOrder` desde un contador compartido entre los dos agujeros
   * negros — ver AGENTS.md §5.1 (targeting FIFO: "el primero que haya
   * aparecido" recibe el clic/tecla primero cuando hay dos activos a la vez).
   */
  takeJustActivated(): boolean {
    const value = this.justActivatedFlag;
    this.justActivatedFlag = false;
    return value;
  }

  /**
   * Reinicio explícito tras fusionarse en un Quasar (ver AGENTS.md §5.1 y
   * engine/entities/Quasar.ts) — vuelve a su ciclo normal de espera, como si
   * nunca se hubiera fusionado. Reutiliza `scheduleHidden()`, el mismo
   * camino que ya sigue tras derrotarla a clics.
   */
  reset() {
    this.scheduleHidden();
  }

  /** Radio real (colisión/atracción/visual) — crece con `growthScale` mientras está activa. */
  get radius() {
    return this.baseRadius * this.growthScale;
  }

  get attractionForce() {
    const timeMultiplier =
      this.phase === "active" ? 1 + (MAX_ATTRACTION_MULTIPLIER - 1) * Math.min(1, this.elapsed / GROWTH_RAMP_MS) : 1;
    return this.blackHoleConfig.attractionForce * timeMultiplier;
  }

  /**
   * Efecto propio del Agujero Negro Nova (nivel 60+) — pedido explícito del
   * usuario (2026-07-22, ver AGENTS.md §5.1): "provocará que la frecuencia
   * de las rocas sea 3 veces más" mientras está activo. GameEngine lo lee
   * cada frame para triplicar el intervalo de aparición de asteroides.
   */
  get triplesAsteroidSpawn(): boolean {
    return this.variant === "nova" && this.phase === "active";
  }

  /** Clic/Spacebar mientras está activo. Devuelve true si con este clic se derrota. */
  registerClick(): boolean {
    if (this.phase !== "active") return false;
    this.clicksRemaining = Math.max(0, this.clicksRemaining - 1);
    this.applyVisualScale();

    if (this.clicksRemaining <= 0) {
      this.phase = "defeated";
      this.elapsed = 0;
      return true;
    }
    return false;
  }

  /** Combina el progreso de clics (se encoge) con el crecimiento por tiempo (se agranda). */
  private applyVisualScale() {
    const clickProgress = 0.25 + 0.75 * (this.clicksRemaining / this.clicksRequired);
    const scale = clickProgress * this.growthScale;
    this.core.scale.set(scale);
    this.ring.scale.set(scale);
  }

  update(deltaMS: number, level: number) {
    this.elapsed += deltaMS;
    this.ring.rotation += deltaMS * 0.0018;
    if (this.phase === "warning") {
      this.warningStar.alpha = 0.4 + Math.abs(Math.sin(this.elapsed * 0.012)) * 0.6;
      if (this.elapsed >= WARNING_MS) this.activate(level);
      return;
    }
    if (this.phase === "active") {
      // Ya no expira sola — se queda activa (y cada vez más fuerte) hasta
      // que el jugador la derrote a clics. Ver AGENTS.md §5.1 y feedback
      // real del usuario (2026-07-22).
      this.growthScale = 1 + (MAX_GROWTH_SCALE - 1) * Math.min(1, this.elapsed / GROWTH_RAMP_MS);
      this.applyVisualScale();
      // Brillo/parpadeo del disco de acreción — pedido explícito del
      // usuario: "brillará y parpadeará" (ver AGENTS.md §5.1). Solo el
      // Nova; el clásico se queda visualmente igual que siempre.
      if (this.variant === "nova") {
        this.ring.alpha = 0.72 + Math.abs(Math.sin(this.elapsed * 0.0045)) * 0.28;
      }
      return;
    }
    if (this.phase === "defeated") {
      this.core.scale.set(Math.max(0, this.core.scale.x - deltaMS / 500));
      if (this.elapsed >= DEFEATED_MS) this.scheduleHidden();
      return;
    }
    if (this.elapsed >= this.hiddenDuration) this.spawnWarning();
  }
}
