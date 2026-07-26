import { Sprite, type Texture } from "pixi.js";

export class Player {
  readonly sprite: Sprite;
  readonly radius: number;
  invulnerableMs = 0;

  constructor(texture: Texture, private width: number, private height: number, entityScale = 1) {
    this.radius = 44 * entityScale;
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.width = this.radius * 2;
    this.sprite.height = this.radius * 2;
    this.sprite.position.set(width / 2, height / 2);
  }

  /**
   * Resize reactivo (2026-07-26) — bug real reportado por el usuario: al
   * rotar el celular o abrir un dispositivo plegable a mitad de partida, el
   * canvas se redimensionaba (PixiJS `resizeTo`) pero el jugador se quedaba
   * atrapado en los límites de la geometría VIEJA (`width`/`height`
   * capturados una sola vez en el constructor) — se veía como un "hueco" o
   * una zona muerta. No hace falta reposicionar al jugador de golpe: el
   * `Math.min/max` de `update()` ya se re-ejecuta cada frame con los valores
   * nuevos, así que si quedó fuera del nuevo límite se "acomoda" solo en el
   * siguiente frame, sin teletransportarlo.
   */
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  update(deltaMS: number, dx: number, dy: number, speedMultiplier: number, baseSpeed: number) {
    const dt = deltaMS / 1000;
    this.sprite.x += dx * baseSpeed * speedMultiplier * dt;
    this.sprite.y += dy * baseSpeed * speedMultiplier * dt;
    this.sprite.x = Math.min(this.width - this.radius, Math.max(this.radius, this.sprite.x));
    this.sprite.y = Math.min(this.height - this.radius, Math.max(this.radius, this.sprite.y));

    if (this.invulnerableMs > 0) {
      this.invulnerableMs -= deltaMS;
      this.sprite.alpha = Math.floor(this.invulnerableMs / 90) % 2 === 0 ? 0.4 : 1;
    } else {
      this.sprite.alpha = 1;
    }
  }

  applyExternalForce(fx: number, fy: number, deltaMS: number) {
    const dt = deltaMS / 1000;
    this.sprite.x += fx * dt;
    this.sprite.y += fy * dt;
  }

  hit(invulnerabilityMs = 1200) {
    if (this.invulnerableMs > 0) return false;
    this.invulnerableMs = invulnerabilityMs;
    return true;
  }
}
