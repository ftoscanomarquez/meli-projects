import { Container, Graphics } from "pixi.js";

/**
 * Constelaciones de los Caballeros del Zodiaco (nivel 40+) — pedido
 * explícito del usuario (2026-07-22, ver AGENTS.md §4/§5.1): "aparecerán
 * las constelaciones de los caballeros del zodiaco es decir pegaso, fenix,
 * andromeda, dragon, cisne, y los 12 caballeros dorados... solo son
 * adornos visuales". Se dibujan como patrones de constelación simplificados
 * (puntos + líneas, igual espíritu que `ZODIAC_PATTERNS` en
 * parallaxSystem.ts) usando los nombres/formas de constelaciones
 * ASTRONÓMICAS REALES que comparten nombre con esos personajes (Pegaso,
 * Cisne/Cruz del Norte, Dragón, Andrómeda, Fénix son constelaciones de
 * verdad; los 12 "dorados" son los 12 signos zodiacales reales) — nunca se
 * reproduce el diseño de ningún personaje con derechos de autor, solo
 * patrones de estrellas con ese nombre.
 *
 * A diferencia del resto del fondo (`ParallaxBackground`), que hornea sus
 * texturas una sola vez en un `TilingSprite` estático, esta capa vive en
 * `Graphics` reales para poder brillar/parpadear cuadro a cuadro — pedido
 * explícito del usuario. Capa completamente decorativa, sin colisión.
 */

type ZodiacPattern = { points: [number, number][]; gold: boolean };

// Constelaciones "bronce" — Pegaso, Fénix, Andrómeda, Dragón, Cisne.
const BRONZE_PATTERNS: ZodiacPattern[] = [
  // Pegaso — el "Gran Cuadrado" + una línea de cuello.
  { points: [[-34, -34], [-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]], gold: false },
  // Fénix — silueta simplificada tipo ave.
  { points: [[-16, 10], [-4, -6], [10, -10], [20, 0], [10, 10], [-4, 14], [-16, 10]], gold: false },
  // Andrómeda — cadena curva de estrellas.
  { points: [[-28, 6], [-10, -2], [8, 4], [26, -6]], gold: false },
  // Dragón — cola larga en zigzag terminando cerca de una cabeza.
  { points: [[-30, 20], [-18, 8], [-24, -4], [-10, -10], [-14, -22], [2, -20], [6, -8], [18, -14]], gold: false },
  // Cisne — Cruz del Norte (cuatro brazos desde el centro).
  { points: [[0, -26], [0, 0], [-20, 10], [0, 0], [20, 10], [0, 0], [0, 20]], gold: false },
];

// Los 12 signos zodiacales reales — mapean 1:1 a los 12 Caballeros Dorados.
// Parpadean en DORADO (pedido explícito del usuario), a diferencia de las
// constelaciones "bronce" de arriba.
const GOLD_PATTERNS: ZodiacPattern[] = [
  { points: [[-14, -10], [-4, -16], [8, -12], [14, -2], [8, 8]], gold: true }, // Aries
  { points: [[-20, -4], [-6, 12], [8, -4], [22, -14]], gold: true }, // Tauro
  { points: [[-14, 20], [-14, -20], [14, -20], [14, 20]], gold: true }, // Géminis
  { points: [[-10, -6], [4, -14], [14, 2], [2, 12], [-10, -6]], gold: true }, // Cáncer
  { points: [[-18, -14], [-6, -20], [6, -14], [8, 0], [-4, 8], [-18, 2], [-18, -14]], gold: true }, // Leo
  { points: [[-26, 10], [-14, -4], [0, 6], [14, -8], [26, 4]], gold: true }, // Virgo
  { points: [[-16, 10], [0, -14], [16, 10], [-16, 10]], gold: true }, // Libra
  { points: [[-24, -16], [-12, -6], [0, 4], [10, 14], [16, 26], [10, 36], [0, 34]], gold: true }, // Escorpio
  { points: [[-16, 8], [-6, -6], [8, -8], [18, 4], [10, 14], [-4, 16], [-16, 8]], gold: true }, // Sagitario
  { points: [[-20, 6], [-4, -14], [16, 0], [20, 14], [-8, 16], [-20, 6]], gold: true }, // Capricornio
  { points: [[-20, -14], [-10, -2], [-16, 10], [-4, 18], [6, 10], [0, -4], [10, -14]], gold: true }, // Acuario
  { points: [[-24, -8], [-12, 4], [-20, 14], [-12, 4], [10, 2], [22, -10], [28, 4]], gold: true }, // Piscis
];

const ALL_PATTERNS = [...BRONZE_PATTERNS, ...GOLD_PATTERNS];
const SPACING = 460; // separación horizontal entre constelaciones consecutivas
const WRAP_MARGIN = 320; // margen antes de reciclar una constelación al otro extremo

const BRONZE_COLOR = 0xcfe8ff; // blanco-azulado brillante — mismo espíritu que drawConstellation()
const GOLD_COLOR = 0xffd700;

function drawZodiacPattern(g: Graphics, pattern: ZodiacPattern) {
  const color = pattern.gold ? GOLD_COLOR : BRONZE_COLOR;
  const [first, ...rest] = pattern.points;
  g.moveTo(first[0], first[1]);
  for (const [x, y] of rest) g.lineTo(x, y);
  g.stroke({ width: 1.6, color, alpha: 0.75 });
  for (const [x, y] of pattern.points) {
    g.circle(x, y, 2.6).fill({ color, alpha: 1 });
  }
}

type ZodiacInstance = { g: Graphics; baseY: number; blinkPhase: number };

// Rng propio, local a esta capa (mismo patrón que `seededRng()` en
// parallaxSystem.ts) — a propósito NO usa el `rng` compartido del motor
// (engine/rng.ts): esta capa es 100% decorativa/no interactiva, así que no
// necesita estar sincronizada entre clientes en multijugador, y evita
// perturbar el consumo del rng compartido que sí importa para que
// asteroides/Sol/Agujero Negro coincidan entre jugadores (ver AGENTS.md §8).
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export class ZodiacLayer {
  readonly container = new Container();
  private instances: ZodiacInstance[] = [];
  private elapsed = 0;
  private readonly totalSpan: number;
  private height: number;

  constructor(width: number, height: number) {
    this.height = height;
    const rng = seededRng(31);
    this.totalSpan = ALL_PATTERNS.length * SPACING;
    // Dos vueltas completas del set para que siempre haya varias visibles
    // en pantallas anchas, sin dejar huecos al reciclar.
    const copies = Math.max(1, Math.ceil((width + WRAP_MARGIN * 2) / this.totalSpan) + 1);

    for (let copy = 0; copy < copies; copy++) {
      ALL_PATTERNS.forEach((pattern, i) => {
        const g = new Graphics();
        drawZodiacPattern(g, pattern);
        g.scale.set(1.9);
        const x = copy * this.totalSpan + i * SPACING + rng() * 60;
        const baseY = height * (0.08 + rng() * 0.38);
        g.position.set(x, baseY);
        this.container.addChild(g);
        this.instances.push({ g, baseY, blinkPhase: (copy * ALL_PATTERNS.length + i) * 1.7 });
      });
    }
  }

  /**
   * Resize reactivo (2026-07-26) — a diferencia de Sun/BlackHole (que solo
   * LEEN width/height al recalcular una posición futura), esta capa HORNEA
   * `baseY` como posición absoluta en el constructor — sin ajustarla, tras
   * rotar el celular o abrir un plegable las constelaciones quedarían
   * ancladas a la altura vieja (podrían salirse de encuadre en la nueva).
   * Se reescala cada `baseY` proporcionalmente al cambio de alto; el ancho
   * no se toca (regenerar el número de copias horizontales exigiría
   * reconstruir toda la capa, y el wrap-around de `update()` ya tolera un
   * ancho de viewport distinto al de construcción sin dejar huecos).
   */
  resize(width: number, height: number) {
    if (this.height === height) return;
    const ratio = height / this.height;
    for (const inst of this.instances) {
      inst.baseY *= ratio;
      inst.g.y = inst.baseY;
    }
    this.height = height;
  }

  /** `scrollSpeedPxPerSec` — mismo scroll que el resto del fondo lejano (ver ParallaxBackground). */
  update(deltaMS: number, scrollSpeedPxPerSec: number) {
    this.elapsed += deltaMS;
    for (const inst of this.instances) {
      inst.g.x -= (deltaMS / 1000) * scrollSpeedPxPerSec;
      if (inst.g.x < -WRAP_MARGIN) inst.g.x += this.totalSpan;
      // Brillo/parpadeo — pedido explícito del usuario ("brillarán y
      // parpadearán"; los dorados "parpadearán en dorado", ya cubierto por
      // el color fijo con el que se dibujaron). Cada instancia parpadea
      // fuera de fase (`blinkPhase`) para que no titilen todas a la vez.
      inst.g.alpha = 0.45 + Math.abs(Math.sin(this.elapsed * 0.0022 + inst.blinkPhase)) * 0.55;
    }
  }
}
