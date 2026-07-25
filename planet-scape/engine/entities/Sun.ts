import { Container, Graphics } from "pixi.js";
import type { Rng } from "../rng";

/**
 * Ver AGENTS.md §5.1: entra por un borde aleatorio, boca/ojos animados,
 * escupe 2-10 llamaradas (rango crece con el nivel) en direcciones
 * aleatorias. Ciclo: entrando -> descansando (escupe ráfagas) -> saliendo
 * -> oculto (cooldown) -> vuelve a entrar por un borde distinto.
 */

type SunPhase = "hidden" | "entering" | "resting" | "exiting";

// `unblockable: true` marca las llamaradas del Sol Rojo (nivel 45+, ver
// AGENTS.md §5.1) — GameEngine las spawnea en un canal de partículas
// separado (`redFlareParticles`) y las revisa en `checkCollisions()` SIN
// aplicar ningún escudo/inmunidad (Venus, Júpiter propio o de compañero,
// pasiva de Mercurio) — pedido explícito del usuario: "estas no podrán ser
// bloqueadas por ningún escudo".
export type FlareBurst = { x: number; y: number; directions: { vx: number; vy: number }[]; unblockable: boolean };

export type SunConfig = { minFlares: number; maxFlares: number; spawnFrequencyMs: number };
const DEFAULT_SUN_CONFIG: SunConfig = { minFlares: 2, maxFlares: 10, spawnFrequencyMs: 3200 };

// Paleta amarilla (por defecto) vs. Sol Rojo — pedido explícito del usuario
// (2026-07-22, ver AGENTS.md §5.1): "a partir del nivel 45 además del sol
// amarillo aparecerá también otro sol rojo que tendrá las mismas
// configuraciones que el sol amarillo". Mismo comportamiento/clase, solo
// cambia la paleta de color y el flag `unblockable` de sus llamaradas.
export type SunPalette = { core: number; highlight: number; flameA: number; flameB: number; mouth: number };
const YELLOW_PALETTE: SunPalette = { core: 0xffc93c, highlight: 0xfff3c4, flameA: 0xff6a3d, flameB: 0xffc93c, mouth: 0x7a3b12 };
export const RED_SUN_PALETTE: SunPalette = { core: 0xff3b3b, highlight: 0xffb08a, flameA: 0xb3001f, flameB: 0xff5a3d, mouth: 0x5c0a0a };

export class Sun {
  readonly container: Container;
  private body: Graphics;
  private mouth: Graphics;
  private fireRing: Container;
  private phase: SunPhase = "hidden";
  private phaseElapsed = 0;
  private hiddenDuration = 4000;
  private restDuration = 9000;
  private travelDuration = 1800;
  private startX = 0;
  private startY = 0;
  private targetX = 0;
  private targetY = 0;
  private nextFlareIn = 0;
  private talking = false;
  // Timer suelto de `setMouth(true)` — ver `destroy()`: si el motor se
  // destruye (fin de partida, navegación fuera, hot-reload en dev) mientras
  // el Sol tiene la boca abierta, este timeout llegaba después con `this.mouth`
  // ya destruido por PixiJS y tronaba con "Cannot read properties of null
  // (reading 'clear')" — bug real reportado en vivo, ver RETROSPECTIVA.md.
  private mouthTimer: number | null = null;

  constructor(
    private width: number,
    private height: number,
    private rng: Rng,
    private sunConfig: SunConfig = DEFAULT_SUN_CONFIG,
    private palette: SunPalette = YELLOW_PALETTE,
    // Ver comentario de `FlareBurst.unblockable` arriba — el Sol Rojo lo
    // pasa en `true`, el Sol amarillo de siempre se queda en `false`.
    private unblockableFlares = false,
  ) {
    this.container = new Container();
    this.container.visible = false;

    this.fireRing = new Container();
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const flame = new Graphics()
        .ellipse(0, 0, 10, 22)
        .fill({ color: i % 2 === 0 ? palette.flameA : palette.flameB, alpha: 0.7 });
      flame.position.set(Math.cos(angle) * 58, Math.sin(angle) * 58);
      flame.rotation = angle + Math.PI / 2;
      this.fireRing.addChild(flame);
    }

    this.body = new Graphics()
      .circle(0, 0, 50)
      .fill(palette.core)
      .circle(-14, -16, 20)
      .fill({ color: palette.highlight, alpha: 0.55 });

    // ojos
    this.body.ellipse(-16, -6, 6, 8).fill(0x3a1f0a).ellipse(16, -6, 6, 8).fill(0x3a1f0a);
    this.body.circle(-14, -9, 2).fill(0xffffff).circle(18, -9, 2).fill(0xffffff);

    this.mouth = new Graphics();

    this.container.addChild(this.fireRing, this.body, this.mouth);
    this.setMouth(false);
    this.scheduleHidden();
  }

  private setMouth(open: boolean) {
    // Defensa adicional: si de todos modos llega una llamada tardía tras
    // destroy(), no truena — PixiJS marca `destroyed: true` en vez de
    // dejar el objeto en un estado a medias.
    if (this.mouth.destroyed) return;
    this.mouth.clear();
    if (open) {
      this.mouth.moveTo(-14, 16).quadraticCurveTo(0, 32, 14, 16).quadraticCurveTo(0, 24, -14, 16);
      this.mouth.fill(this.palette.mouth);
    } else {
      this.mouth.moveTo(-12, 18).quadraticCurveTo(0, 26, 12, 18);
      this.mouth.stroke({ width: 3, color: this.palette.mouth });
    }
  }

  private scheduleHidden() {
    this.phase = "hidden";
    this.phaseElapsed = 0;
    this.hiddenDuration = 6000 + this.rng() * 6000;
    this.container.visible = false;
  }

  private enterFromRandomEdge() {
    const edge = Math.floor(this.rng() * 4);
    if (edge === 0) [this.startX, this.startY] = [-80, this.rng() * this.height];
    else if (edge === 1) [this.startX, this.startY] = [this.width + 80, this.rng() * this.height];
    else if (edge === 2) [this.startX, this.startY] = [this.rng() * this.width, -80];
    else [this.startX, this.startY] = [this.rng() * this.width, this.height + 80];

    this.targetX = this.width * (0.25 + this.rng() * 0.5);
    this.targetY = this.height * (0.12 + this.rng() * 0.22);
    this.container.position.set(this.startX, this.startY);
    this.container.visible = true;
    this.phase = "entering";
    this.phaseElapsed = 0;
  }

  /** Devuelve una ráfaga de llamaradas cuando corresponde escupir, si no `null`. */
  update(deltaMS: number, level: number): FlareBurst | null {
    this.phaseElapsed += deltaMS;
    this.fireRing.rotation += deltaMS * 0.0006;

    if (this.phase === "hidden") {
      if (this.phaseElapsed >= this.hiddenDuration) this.enterFromRandomEdge();
      return null;
    }

    if (this.phase === "entering") {
      const t = Math.min(1, this.phaseElapsed / this.travelDuration);
      this.container.x = this.startX + (this.targetX - this.startX) * t;
      this.container.y = this.startY + (this.targetY - this.startY) * t;
      if (t >= 1) {
        this.phase = "resting";
        this.phaseElapsed = 0;
        this.nextFlareIn = 900 + this.rng() * 1200;
      }
      return null;
    }

    if (this.phase === "resting") {
      if (this.phaseElapsed >= this.restDuration) {
        this.phase = "exiting";
        this.phaseElapsed = 0;
        [this.startX, this.startY] = [this.container.x, this.container.y];
        const edge = Math.floor(this.rng() * 4);
        if (edge === 0) [this.targetX, this.targetY] = [-80, this.container.y];
        else if (edge === 1) [this.targetX, this.targetY] = [this.width + 80, this.container.y];
        else if (edge === 2) [this.targetX, this.targetY] = [this.container.x, -80];
        else [this.targetX, this.targetY] = [this.container.x, this.height + 80];
        return null;
      }

      this.nextFlareIn -= deltaMS;
      if (this.nextFlareIn <= 0) {
        // Rango configurable por admin (game_config.sun) — el mínimo crece
        // un poco con el nivel sin pasar del máximo — ver AGENTS.md §5.1/§9.
        const min = this.sunConfig.minFlares;
        const max = Math.min(this.sunConfig.maxFlares, min + Math.floor(level * 0.8));
        const count = min + Math.floor(this.rng() * Math.max(1, max - min + 1));
        this.nextFlareIn = Math.max(1400, this.sunConfig.spawnFrequencyMs - level * 120) + this.rng() * 1000;
        this.talking = true;
        this.setMouth(true);
        if (this.mouthTimer) clearTimeout(this.mouthTimer);
        this.mouthTimer = setTimeoutSafe(() => {
          this.mouthTimer = null;
          this.talking = false;
          this.setMouth(false);
        }, 380);

        // BUG REAL DE MULTIJUGADOR corregido (2026-07-22): antes se hacía
        // `Array.from({ length: count }, ...)` con `count` dependiente de
        // `level` — y `level` es una variable LOCAL de cada cliente (cada
        // jugador sube de nivel por su cuenta al derrotar SU propio agujero
        // negro a clics; nunca se sincroniza entre jugadores). En cuanto dos
        // jugadores tenían niveles distintos, uno consumía más/menos
        // números aleatorios del `rng` COMPARTIDO que el otro en esta misma
        // llamada — desde ese instante, todo lo demás que depende del mismo
        // `rng` (próximos asteroides, próxima aparición del Sol, próximo
        // Agujero Negro) se desincronizaba PARA SIEMPRE entre ambos
        // clientes: uno veía un Agujero Negro que el otro nunca recibía.
        // Reportado en vivo por el usuario jugando con su hija.
        //
        // Arreglo: consumir SIEMPRE la misma cantidad de números aleatorios
        // (`sunConfig.maxFlares`, que viene de `game_config` — idéntico para
        // todos los clientes de la sala, a diferencia de `level`), y usar
        // solo los primeros `count` — así el cursor del `rng` compartido
        // avanza exactamente igual en todos los clientes sin importar en
        // qué nivel esté cada quien localmente.
        const directions = Array.from({ length: this.sunConfig.maxFlares }, () => {
          const angle = this.rng() * Math.PI * 2;
          const speed = 140 + this.rng() * 90;
          return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
        }).slice(0, count);
        return { x: this.container.x, y: this.container.y, directions, unblockable: this.unblockableFlares };
      }
      return null;
    }

    // exiting
    const t = Math.min(1, this.phaseElapsed / this.travelDuration);
    this.container.x = this.startX + (this.targetX - this.startX) * t;
    this.container.y = this.startY + (this.targetY - this.startY) * t;
    if (t >= 1) this.scheduleHidden();
    return null;
  }

  /** Cancela el timer suelto de la boca — llamar siempre antes de destruir el `container`/sus Graphics. */
  destroy() {
    if (this.mouthTimer) {
      clearTimeout(this.mouthTimer);
      this.mouthTimer = null;
    }
  }
}

function setTimeoutSafe(fn: () => void, ms: number): number | null {
  if (typeof window === "undefined") return null;
  return window.setTimeout(fn, ms) as unknown as number;
}
