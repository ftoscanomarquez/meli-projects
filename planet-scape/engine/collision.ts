/**
 * Cálculo de colisiones puro (círculo vs. círculo) — ver AGENTS.md §11.
 * Extraído de `GameEngine.checkCollisions()` para poder probarlo con
 * Vitest sin depender de PixiJS/WebGL; el comportamiento del motor no
 * cambia, solo se nombra y deduplica el mismo cálculo que ya se repetía
 * inline en varios puntos (jugador vs. núcleo del agujero negro, llamaradas,
 * luna de la Tierra, asteroides/pulsares/estrella).
 */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  return distance(ax, ay, bx, by) < ar + br;
}
