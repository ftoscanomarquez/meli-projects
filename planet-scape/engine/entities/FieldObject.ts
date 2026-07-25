import { Sprite, type Texture } from "pixi.js";
import type { Rng } from "../rng";

/**
 * Asteroides, pulsares y estrellas comparten el mismo comportamiento de
 * entrada/salida (ver AGENTS.md §5.1: "aparecerán como si fueran también
 * asteroides ... con su propia trayectoria y velocidad aleatoria") — un
 * solo tipo con un `kind` que decide qué pasa al colisionar con el jugador.
 */
export type FieldObjectKind = "asteroid" | "pulsarSmall" | "pulsarLarge" | "star";

export class FieldObject {
  readonly sprite: Sprite;
  readonly kind: FieldObjectKind;
  readonly radius: number;
  vx: number;
  vy: number;
  private rotationSpeed: number;
  consumed = false; // true mientras el agujero negro lo está absorbiendo
  // Congelado por la pasiva/activa/tormenta de equipo de Neptuno ahora mismo
  // (ver GameEngine.ts#updateFieldObjects) — pedido explícito del usuario
  // (2026-07-23): "cuando los choquen Neptuno u otro participante los
  // asteroides congelados tendran una pequeña animacione donde se rompen en
  // cachitos de hielo". Solo relevante para `kind === "asteroid"`.
  frozen = false;

  constructor(
    texture: Texture,
    kind: FieldObjectKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    rng: Rng,
  ) {
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.position.set(x, y);
    this.sprite.width = radius * 2;
    this.sprite.height = radius * 2;
    this.kind = kind;
    this.radius = radius;
    this.vx = vx;
    this.vy = vy;
    this.rotationSpeed = (rng() - 0.5) * 1.2;
  }

  update(deltaMS: number, speedFactor: number) {
    this.sprite.x += (this.vx * speedFactor * deltaMS) / 1000;
    this.sprite.y += (this.vy * speedFactor * deltaMS) / 1000;
    this.sprite.rotation += this.rotationSpeed * (deltaMS / 1000);
  }

  isOffscreen(width: number, height: number, margin = 120): boolean {
    return (
      this.sprite.x < -margin ||
      this.sprite.x > width + margin ||
      this.sprite.y < -margin ||
      this.sprite.y > height + margin
    );
  }

  /**
   * `container.removeChild()` por sí solo NUNCA libera los recursos de
   * PixiJS (geometría interna, datos de batching, listeners) — solo separa
   * el sprite del árbol de renderizado. Con asteroides/pulsares/estrellas
   * creándose y destruyéndose sin parar durante una partida larga, eso se
   * acumula hasta congelar el navegador — bug real reportado por el
   * usuario (2026-07-22, "llegué al nivel 9 y se lentificó todo", ver
   * RETROSPECTIVA.md). `texture: false` a propósito: las texturas de
   * asteroides/pulsares/estrella vienen de un pool compartido y cacheado
   * (ver engine/textures.ts) — destruirlas aquí rompería a TODOS los demás
   * objetos que las siguen usando.
   */
  destroy() {
    this.sprite.destroy({ texture: false, textureSource: false });
  }
}
