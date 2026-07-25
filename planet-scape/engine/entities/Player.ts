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
