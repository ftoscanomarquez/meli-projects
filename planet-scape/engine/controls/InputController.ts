/**
 * Movimiento: flechas de teclado (PC), arrastre táctil tipo joystick
 * (móvil), o mouse/touchpad en PC — ver PROMPT.md "controles de navegación
 * de flechas y también con el touchpad".
 *
 * El mouse/touchpad usa "el personaje sigue al cursor" (basta con deslizar
 * el dedo por el touchpad, sin mantener presionado) — no "clic y arrastra".
 * Primer intento (2026-07-22) implementó clic-y-arrastra, pero el usuario
 * reportó que en un touchpad real de laptop seguía sin moverse: lo natural
 * en un touchpad es deslizar el dedo para mover el cursor, no mantener un
 * botón presionado. El arrastre táctil real (dedo tocando la pantalla,
 * móvil) sigue siendo "toca y arrastra", que sí tiene sentido ahí.
 *
 * Habilidad/agujero negro: Spacebar o clic (PC) / botón flotante (móvil) —
 * ver AGENTS.md §5, manejado aparte por GameCanvas. Como el movimiento en
 * PC ya no depende de mantener el clic presionado, un clic normal siempre
 * activa la habilidad sin conflicto.
 */
export class InputController {
  private keys = new Set<string>();

  // Arrastre táctil (móvil) — solo pointerType "touch"/"pen".
  private touchDragStart: { x: number; y: number } | null = null;
  private touchDragDelta = { x: 0, y: 0 };
  private readonly touchDragRadius = 60;

  // Mouse/touchpad (PC) — posición del cursor relativa al canvas, sin
  // necesitar mantener presionado. `null` cuando el puntero está fuera del
  // canvas (para no seguir moviéndose hacia la última posición conocida).
  private mousePosition: { x: number; y: number } | null = null;
  private readonly mouseFollowDeadzone = 20; // px cerca del jugador sin moverse — evita vibración
  private readonly mouseFollowRadius = 160; // distancia a la que ya se mueve a velocidad máxima

  constructor(private target: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointerdown", this.onTouchPointerDown);
    target.addEventListener("pointermove", this.onTargetPointerMove);
    target.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("pointermove", this.onWindowPointerMove);
    window.addEventListener("pointerup", this.onTouchPointerUp);
  }

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key);
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key);

  private onTouchPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    this.touchDragStart = { x: e.clientX, y: e.clientY };
  };

  private onWindowPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    if (!this.touchDragStart) return;
    const dx = e.clientX - this.touchDragStart.x;
    const dy = e.clientY - this.touchDragStart.y;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, this.touchDragRadius);
    this.touchDragDelta = {
      x: (dx / dist) * (clamped / this.touchDragRadius),
      y: (dy / dist) * (clamped / this.touchDragRadius),
    };
  };

  private onTouchPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    this.touchDragStart = null;
    this.touchDragDelta = { x: 0, y: 0 };
  };

  /** Mouse/touchpad: sigue al cursor dentro del canvas sin necesitar clic. */
  private onTargetPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    const rect = this.target.getBoundingClientRect();
    this.mousePosition = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  private onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    this.mousePosition = null;
  };

  /**
   * Vector de movimiento normalizado, magnitud máxima 1. Necesita la
   * posición actual del jugador en pantalla para poder calcular "hacia
   * dónde está el cursor respecto a mí" (mouse/touchpad en PC).
   *
   * `dangerZones` opcional (usado para los agujeros negros activos, ver
   * GameEngine.ts — puede haber hasta dos a la vez desde el nivel 60, ver
   * AGENTS.md §5.1): atacarlos es un input global (Spacebar/clic, sin
   * necesitar puntería — AGENTS.md §5.1), pero el instinto natural es dar
   * clic ENCIMA de uno para "apuntar". Con el mouse en modo "seguir cursor"
   * eso literalmente caminaba al jugador adentro, sumándose a la atracción
   * propia del agujero negro — bug real reportado en vivo (nivel 14, vidas
   * agotadas de golpe mientras clicaba rápido para derrotarlo). Se resuelve
   * recortando el punto-objetivo del cursor al borde de CADA zona
   * peligrosa (una tras otra) antes de calcular hacia dónde moverse, sin
   * tocar el resto del control.
   */
  getMovement(
    playerX: number,
    playerY: number,
    dangerZones?: { x: number; y: number; radius: number }[],
  ): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("a")) dx -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("d")) dx += 1;
    if (this.keys.has("ArrowUp") || this.keys.has("w")) dy -= 1;
    if (this.keys.has("ArrowDown") || this.keys.has("s")) dy += 1;

    if (dx === 0 && dy === 0 && this.touchDragStart) {
      dx = this.touchDragDelta.x;
      dy = this.touchDragDelta.y;
    } else if (dx === 0 && dy === 0 && this.mousePosition) {
      let targetX = this.mousePosition.x;
      let targetY = this.mousePosition.y;
      for (const zone of dangerZones ?? []) {
        const zdx = targetX - zone.x;
        const zdy = targetY - zone.y;
        const zdist = Math.hypot(zdx, zdy);
        if (zdist < zone.radius) {
          const ratio = zdist > 0.001 ? zone.radius / zdist : 1;
          targetX = zone.x + zdx * ratio;
          targetY = zone.y + zdy * ratio;
        }
      }
      const mdx = targetX - playerX;
      const mdy = targetY - playerY;
      const dist = Math.hypot(mdx, mdy);
      if (dist > this.mouseFollowDeadzone) {
        const strength = Math.min(1, (dist - this.mouseFollowDeadzone) / this.mouseFollowRadius);
        dx = (mdx / dist) * strength;
        dy = (mdy / dist) * strength;
      }
    }

    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    return { dx, dy };
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointerdown", this.onTouchPointerDown);
    this.target.removeEventListener("pointermove", this.onTargetPointerMove);
    this.target.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("pointermove", this.onWindowPointerMove);
    window.removeEventListener("pointerup", this.onTouchPointerUp);
  }
}
