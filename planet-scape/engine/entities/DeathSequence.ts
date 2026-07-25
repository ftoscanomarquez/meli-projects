import { Container, Graphics, type Sprite } from "pixi.js";
import type { FaceOverlay } from "./FaceOverlay";
import type { ParticlePool } from "../particles/ParticlePool";

/**
 * Secuencia de muerte — pedido explícito del usuario (2026-07-22, ver
 * AGENTS.md §5.1): "para que no termine tan abrupto cuando te eliminan...
 * que se le presente una pequeña animación... cambie su reacción
 * alternando entre miedo y asombro, cómo se va poniendo rojo cada vez más,
 * se le dibujan unas cuarteaduras, se pone más rojo, empieza a vibrar, en
 * el centro sale una explosión intensa, estalla y muere". Reutilizable
 * para CUALQUIER sprite (jugador local o remoto en multijugador — ver
 * AGENTS.md §5.1: "la explosión y la frase épica también son vistas por
 * los demás jugadores"), no solo el jugador local.
 */

const PHASE1_MS = 1200; // tinte rojo progresivo + cuarteaduras apareciendo, cara alterna miedo/asombro
const SHAKE_START_MS = 1200;
const EXPLOSION_AT_MS = 2000;
const TOTAL_MS = 2500;
const FACE_SWITCH_MS = 300;

function lerpColor(a: number, b: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * clamped);
  const g = Math.round(ag + (bg - ag) * clamped);
  const bl = Math.round(ab + (bb - ab) * clamped);
  return (r << 16) | (g << 8) | bl;
}

export class DeathSequence {
  readonly container = new Container();
  private cracksGfx = new Graphics();
  private elapsed = 0;
  private exploded = false;
  active = false;
  private anchorX = 0;
  private anchorY = 0;

  constructor(
    private sprite: Sprite,
    private faceOverlay: FaceOverlay,
    private explosionParticles: ParticlePool,
    private radius: number,
  ) {
    this.container.addChild(this.cracksGfx);
    this.container.visible = false;
  }

  start() {
    this.active = true;
    this.exploded = false;
    this.elapsed = 0;
    this.anchorX = this.sprite.x;
    this.anchorY = this.sprite.y;
    this.sprite.visible = true;
    this.sprite.tint = 0xffffff;
    this.container.visible = true;
    this.container.position.set(this.anchorX, this.anchorY);
    this.drawCracks();
    this.cracksGfx.alpha = 0;
    this.faceOverlay.showFear();
  }

  /** Cuarteaduras aleatorias desde cerca del centro hacia el borde del cuerpo. */
  private drawCracks() {
    const g = this.cracksGfx.clear();
    const lineCount = 5;
    for (let i = 0; i < lineCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      let x = (Math.random() - 0.5) * 6;
      let y = (Math.random() - 0.5) * 6;
      g.moveTo(x, y);
      const segments = 3;
      for (let s = 0; s < segments; s++) {
        const dist = (this.radius / segments) * (s + 1);
        const jitter = (Math.random() - 0.5) * this.radius * 0.3;
        x = Math.cos(angle) * dist + jitter;
        y = Math.sin(angle) * dist + jitter;
        g.lineTo(x, y);
      }
      g.stroke({ width: 2, color: 0x1a0500, alpha: 0.85 });
    }
  }

  /** Devuelve `true` cuando la secuencia completa terminó (ya explotó y se apagó). */
  update(deltaMS: number): boolean {
    if (!this.active) return false;
    this.elapsed += deltaMS;
    const t = this.elapsed;

    if (t < PHASE1_MS) {
      // Alterna miedo/asombro — pedido explícito del usuario.
      const showFear = Math.floor(t / FACE_SWITCH_MS) % 2 === 0;
      if (showFear) this.faceOverlay.showFear();
      else this.faceOverlay.showSurprise();
    }

    this.sprite.tint = lerpColor(0xffffff, 0xdd1111, t / PHASE1_MS);
    this.cracksGfx.alpha = Math.min(1, Math.max(0, (t - 400) / 500));

    let jx = 0;
    let jy = 0;
    if (t > SHAKE_START_MS && t < EXPLOSION_AT_MS) {
      const amp = ((t - SHAKE_START_MS) / (EXPLOSION_AT_MS - SHAKE_START_MS)) * 6;
      jx = (Math.random() - 0.5) * amp;
      jy = (Math.random() - 0.5) * amp;
    }
    this.sprite.position.set(this.anchorX + jx, this.anchorY + jy);
    this.container.position.set(this.anchorX + jx, this.anchorY + jy);

    if (t >= EXPLOSION_AT_MS && !this.exploded) {
      this.exploded = true;
      this.sprite.visible = false;
      this.faceOverlay.hide();
      this.container.visible = false;

      const count = 20;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 120 + Math.random() * 180;
        this.explosionParticles.spawn(
          this.anchorX,
          this.anchorY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          500 + Math.random() * 300,
          0.8 + Math.random() * 0.6,
        );
      }
    }

    if (t >= TOTAL_MS) {
      this.active = false;
      return true;
    }
    return false;
  }

  destroy() {
    this.cracksGfx.destroy();
    this.container.destroy();
  }
}
