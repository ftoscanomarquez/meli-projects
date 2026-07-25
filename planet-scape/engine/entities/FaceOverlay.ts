import { Container, Graphics } from "pixi.js";
import type { FaceExpression } from "../../party/messages";

/**
 * Reacciones faciales chistosas — pedido explícito del usuario (2026-07-22,
 * ver AGENTS.md §5.1): "a todos los planetas cada vez que algo les quite
 * vida además de que parpadeen quiero que momentáneamente cambien sus
 * facciones, por unas chistosas solo un par de segundos". Las 7 expresiones
 * las puede hacer CUALQUIER planeta (dibujadas encima del sprite, no parte
 * de su textura SVG propia) — se elige una al azar en cada golpe. Las
 * mismas piezas (miedo/asombro) se reutilizan en la secuencia de muerte
 * (ver `showFear()`/`showSurprise()`, llamadas directamente por
 * `engine/entities/DeathSequence.ts` en vez de una elegida al azar).
 * `FaceExpression` vive en `party/messages.ts` (protocolo de red) — ver
 * AGENTS.md §5.1: así ni este archivo ni el servidor de PartyKit tienen que
 * importar del otro.
 */
export type { FaceExpression };

const ALL_EXPRESSIONS: FaceExpression[] = ["crossEyes", "surprise", "fear", "tongueOut", "grimace", "dizzySpiral", "stars"];

// Posiciones típicas de ojos/boca usadas por los SVG de personajes (ver
// components/characters/*.tsx) — se reutiliza la misma geometría aproximada
// para que la expresión quede alineada con la cara real debajo.
const EYE_L = { x: -16, y: -6 };
const EYE_R = { x: 16, y: -6 };
const MOUTH_Y = 18;

export class FaceOverlay {
  readonly container: Container;
  private gfx: Graphics;
  private expression: FaceExpression | null = null;
  private remainingMs = 0;
  private starsRotation = 0;

  constructor() {
    this.container = new Container();
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
    this.container.visible = false;
  }

  /**
   * Reacción aleatoria al recibir daño sin morir — ver AGENTS.md §5.1.
   * Devuelve la expresión elegida para que GameEngine pueda avisarle a los
   * demás jugadores en multijugador (`multiplayer.sendFaceReaction`) —
   * pedido explícito del usuario: todos deben ver la MISMA reacción, no
   * que cada cliente elija la suya por separado para el mismo golpe.
   */
  triggerRandomReaction(durationMs = 1600): FaceExpression {
    const pick = ALL_EXPRESSIONS[Math.floor(Math.random() * ALL_EXPRESSIONS.length)];
    this.showExpression(pick, durationMs);
    return pick;
  }

  /** Usado por jugadores remotos (ver GameEngine.ts#onFaceReaction) para reproducir la MISMA expresión que eligió el otro cliente. */
  showExpression(expression: FaceExpression, durationMs = 1600) {
    this.show(expression, durationMs);
  }

  /** Usadas explícitamente por la secuencia de muerte (no aleatorias ahí). */
  showFear() {
    this.show("fear", Infinity);
  }
  showSurprise() {
    this.show("surprise", Infinity);
  }

  hide() {
    this.expression = null;
    this.container.visible = false;
  }

  private show(expression: FaceExpression, durationMs: number) {
    this.expression = expression;
    this.remainingMs = durationMs;
    this.container.visible = true;
    this.draw(expression);
  }

  update(deltaMS: number) {
    if (!this.expression) return;
    this.starsRotation += deltaMS * 0.004;
    if (this.expression === "stars") this.draw("stars"); // animadas, se redibujan cada cuadro

    if (this.remainingMs === Infinity) return; // controlada a mano (secuencia de muerte)
    this.remainingMs -= deltaMS;
    if (this.remainingMs <= 0) this.hide();
  }

  private draw(expression: FaceExpression) {
    const g = this.gfx.clear();
    switch (expression) {
      case "crossEyes": {
        // Ojos en cruz (X X) — golpe "clásico" de dibujo animado.
        for (const eye of [EYE_L, EYE_R]) {
          g.moveTo(eye.x - 5, eye.y - 5)
            .lineTo(eye.x + 5, eye.y + 5)
            .moveTo(eye.x + 5, eye.y - 5)
            .lineTo(eye.x - 5, eye.y + 5)
            .stroke({ width: 3, color: 0x2a1200 });
        }
        break;
      }
      case "surprise": {
        // Ojos muy abiertos + boca en "O" — asombro.
        for (const eye of [EYE_L, EYE_R]) {
          g.circle(eye.x, eye.y, 7).fill(0xffffff).circle(eye.x, eye.y, 3).fill(0x2a1200);
        }
        g.circle(0, MOUTH_Y - 4, 6).fill(0x7a3b12);
        break;
      }
      case "fear": {
        // Ojos chiquitos temblorosos + boca ondulada + gota de sudor.
        for (const eye of [EYE_L, EYE_R]) {
          g.circle(eye.x, eye.y, 3).fill(0x2a1200);
        }
        g.moveTo(-10, MOUTH_Y).quadraticCurveTo(-4, MOUTH_Y + 5, 0, MOUTH_Y).quadraticCurveTo(4, MOUTH_Y - 5, 10, MOUTH_Y);
        g.stroke({ width: 2.5, color: 0x2a1200 });
        g.moveTo(26, -14).quadraticCurveTo(30, -6, 26, 0).quadraticCurveTo(22, -6, 26, -14).fill({ color: 0x6fc8ff, alpha: 0.85 });
        break;
      }
      case "tongueOut": {
        // Ojos cerrados felices (^ ^) + lengua afuera.
        for (const eye of [EYE_L, EYE_R]) {
          g.moveTo(eye.x - 6, eye.y).quadraticCurveTo(eye.x, eye.y - 6, eye.x + 6, eye.y).stroke({ width: 3, color: 0x2a1200 });
        }
        g.roundRect(-6, MOUTH_Y - 2, 12, 16, 5).fill(0xff6a8a);
        break;
      }
      case "grimace": {
        // Cejas fruncidas + boca en zigzag (dientes apretados).
        g.moveTo(EYE_L.x - 7, EYE_L.y - 7)
          .lineTo(EYE_L.x + 5, EYE_L.y - 2)
          .moveTo(EYE_R.x + 7, EYE_R.y - 7)
          .lineTo(EYE_R.x - 5, EYE_R.y - 2)
          .stroke({ width: 3, color: 0x2a1200 });
        g.moveTo(-12, MOUTH_Y);
        for (let i = 0; i < 5; i++) g.lineTo(-12 + i * 6, MOUTH_Y + (i % 2 === 0 ? 5 : -5));
        g.stroke({ width: 2.5, color: 0x2a1200 });
        break;
      }
      case "dizzySpiral": {
        // Ojos en espiral — mareado/bizco.
        for (const eye of [EYE_L, EYE_R]) {
          g.moveTo(eye.x, eye.y);
          for (let i = 0; i < 14; i++) {
            const a = i * 0.9;
            const r = i * 0.5;
            g.lineTo(eye.x + Math.cos(a) * r, eye.y + Math.sin(a) * r);
          }
          g.stroke({ width: 1.6, color: 0x2a1200 });
        }
        break;
      }
      case "stars": {
        // Estrellitas orbitando la cabeza — noqueado, tipo caricatura.
        for (let i = 0; i < 3; i++) {
          const a = this.starsRotation + (i / 3) * Math.PI * 2;
          const sx = Math.cos(a) * 26;
          const sy = -46 + Math.sin(a) * 8;
          g.star(sx, sy, 5, 5, 2.4).fill(0xffd700);
        }
        break;
      }
    }
  }
}
