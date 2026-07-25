import { Graphics, TilingSprite, type Renderer } from "pixi.js";

/**
 * Efecto "Isla Prehistórica" (ver AGENTS.md §4 y PROMPT.md): el fondo se
 * desplaza continuamente hacia la izquierda mientras el jugador se mueve
 * libremente dentro del viewport. Cuatro capas de atrás hacia adelante —
 * ver AGENTS.md §4: estrellas fijas (estático), constelaciones/galaxias
 * lejanas (lento), planetas de fondo aleatorios (medio), capa de juego
 * (rápido, entidades reales fuera de este archivo). Ajustado tras feedback
 * real del usuario (2026-07-22): "que la velocidad del fondo sea un poco
 * más rápido" y "no vi galaxias famosas ni constelaciones del zodiaco".
 */

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildStarfieldTexture(renderer: Renderer, size: number, dotCount: number, colors: number[]) {
  const g = new Graphics();
  const rng = seededRng(42);
  for (let i = 0; i < dotCount; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.6 + rng() * 1.6;
    const color = colors[Math.floor(rng() * colors.length)];
    g.circle(x, y, r).fill({ color, alpha: 0.4 + rng() * 0.6 });
  }
  return renderer.generateTexture(g);
}

/** Dibuja una constelación como puntos conectados por líneas finas — patrón
 * simplificado, no un mapa estelar exacto. Más brillante que antes (pedido
 * real del usuario, 2026-07-22: "constelaciones... que sean más brillantes"). */
function drawConstellation(g: Graphics, cx: number, cy: number, scale: number, points: [number, number][]) {
  const abs = points.map(([px, py]) => [cx + px * scale, cy + py * scale] as const);
  g.moveTo(abs[0][0], abs[0][1]);
  for (let i = 1; i < abs.length; i++) g.lineTo(abs[i][0], abs[i][1]);
  g.stroke({ width: 1.3, color: 0x9fb3ff, alpha: 0.55 });
  for (const [x, y] of abs) {
    g.circle(x, y, 2.1).fill({ color: 0xe8ecff, alpha: 1 });
  }
}

/** Galaxia espiral simplificada: núcleo brillante + un par de brazos de puntos.
 * Más brillante que antes (alphas subidos) — pedido real del usuario
 * (2026-07-22): "las galaxias de fondo... que sean más brillantes". */
function drawSpiralGalaxy(g: Graphics, cx: number, cy: number, radius: number, armColor: number, rng: () => number) {
  g.circle(cx, cy, radius * 0.16).fill({ color: 0xfff3d6, alpha: 0.75 });
  for (let arm = 0; arm < 2; arm++) {
    const armOffset = arm * Math.PI;
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const angle = armOffset + t * Math.PI * 2.2;
      const r = t * radius;
      const jitter = (rng() - 0.5) * radius * 0.12;
      g.circle(cx + Math.cos(angle) * r + jitter, cy + Math.sin(angle) * r + jitter, 0.6 + rng() * 1.1).fill({
        color: armColor,
        alpha: 0.3 + rng() * 0.3,
      });
    }
  }
}

// Nebulosas de colores neón — pedido explícito del usuario (2026-07-22):
// "las nebulosas que sean más colores vivos brillantes y neones y pon
// muchas más variedades". Nube difusa: varias capas de círculos
// semitransparentes superpuestos en tonos vivos, más denso al centro.
const NEBULA_PALETTES: { core: number; outer: number }[] = [
  { core: 0xff2fd6, outer: 0xff6ad5 }, // magenta neón
  { core: 0x2fffe0, outer: 0x5cf3ff }, // cian neón
  { core: 0x8b2fff, outer: 0xb35cff }, // púrpura neón
  { core: 0x2fff6a, outer: 0x7dffb0 }, // verde neón
  { core: 0xffa62f, outer: 0xffd15c }, // naranja neón
];

function drawNebula(g: Graphics, cx: number, cy: number, radius: number, palette: { core: number; outer: number }, rng: () => number) {
  const blobCount = 10 + Math.floor(rng() * 6);
  for (let i = 0; i < blobCount; i++) {
    const t = i / blobCount;
    const angle = rng() * Math.PI * 2;
    const dist = t * radius * 0.75;
    const bx = cx + Math.cos(angle) * dist;
    const by = cy + Math.sin(angle) * dist;
    const blobRadius = radius * (0.35 + rng() * 0.4) * (1 - t * 0.4);
    const color = rng() < 0.5 ? palette.core : palette.outer;
    g.circle(bx, by, blobRadius).fill({ color, alpha: 0.06 + rng() * 0.07 });
  }
  // Núcleo brillante al centro — le da el punto focal "vivo" a la nube.
  g.circle(cx, cy, radius * 0.12).fill({ color: palette.core, alpha: 0.4 });
}

// Constelaciones del zodiaco (patrones muy simplificados, reconocibles a
// pequeña escala): Escorpio (gancho), Sagitario (tetera), Leo (hoz), Tauro (V).
const ZODIAC_PATTERNS: [number, number][][] = [
  // Escorpio — gancho característico
  [
    [-30, -20],
    [-18, -10],
    [-6, 0],
    [4, 10],
    [10, 22],
    [4, 32],
    [-6, 30],
  ],
  // Sagitario — asterismo "tetera"
  [
    [-20, 10],
    [-10, -6],
    [8, -8],
    [20, 4],
    [14, 16],
    [-4, 18],
    [-20, 10],
    [-4, 18],
    [-4, 34],
  ],
  // Leo — hoz + cuerpo triangular
  [
    [-16, -18],
    [-4, -24],
    [8, -18],
    [10, -4],
    [-2, 4],
    [-16, -2],
    [-16, -18],
  ],
  // Tauro — V característica (Híades) con Aldebarán
  [
    [-20, 0],
    [-6, 14],
    [8, 0],
    [20, -10],
  ],
];

function buildDecorTexture(renderer: Renderer, size: number) {
  const g = new Graphics();
  const rng = seededRng(7);

  // Nebulosas neón PRIMERO (quedan detrás de galaxias/constelaciones al
  // dibujarse antes) — más variedad y colores vivos, pedido explícito del
  // usuario (2026-07-22). Una por cada paleta para variedad garantizada,
  // más un par extra reutilizando paletas en otras posiciones.
  const nebulaSpots: [number, number, number][] = [
    [size * 0.12, size * 0.18, 95],
    [size * 0.55, size * 0.42, 120],
    [size * 0.88, size * 0.14, 85],
    [size * 0.3, size * 0.82, 100],
    [size * 0.78, size * 0.78, 90],
    [size * 0.48, size * 0.95, 75],
  ];
  nebulaSpots.forEach(([nx, ny, nr], i) => {
    drawNebula(g, nx, ny, nr, NEBULA_PALETTES[i % NEBULA_PALETTES.length], rng);
  });

  // Galaxias estilizadas (espiral) — más variedad de color que antes (2 fijas).
  const galaxyColors = [0xc9b8ff, 0xffd9c9, 0x9cffe8, 0xffb8e0, 0xd8ff9c];
  const galaxySpots: [number, number, number][] = [
    [size * 0.22, size * 0.28, 70],
    [size * 0.72, size * 0.68, 55],
    [size * 0.9, size * 0.5, 45],
    [size * 0.4, size * 0.08, 50],
  ];
  galaxySpots.forEach(([gx, gy, gr], i) => {
    drawSpiralGalaxy(g, gx, gy, gr, galaxyColors[i % galaxyColors.length], rng);
  });

  // Constelaciones del zodiaco distribuidas en el tile.
  const positions: [number, number][] = [
    [size * 0.15, size * 0.72],
    [size * 0.5, size * 0.18],
    [size * 0.85, size * 0.35],
    [size * 0.62, size * 0.85],
  ];
  ZODIAC_PATTERNS.forEach((pattern, i) => {
    const [px, py] = positions[i % positions.length];
    drawConstellation(g, px, py, 1.4, pattern);
  });

  return renderer.generateTexture(g);
}

function buildBackgroundPlanetsTexture(renderer: Renderer, size: number) {
  const g = new Graphics();
  const rng = seededRng(19);
  const colors = [0x6fa8ff, 0xd9622b, 0xe4592a, 0xb98356, 0x8ff5ff];
  for (let i = 0; i < 5; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 6 + rng() * 14;
    const color = colors[Math.floor(rng() * colors.length)];
    g.circle(x, y, r).fill({ color, alpha: 0.22 + rng() * 0.15 });
    g.circle(x - r * 0.3, y - r * 0.3, r * 0.4).fill({ color: 0xffffff, alpha: 0.08 });
  }
  return renderer.generateTexture(g);
}

// Nivel en el que aparecen las constelaciones del zodiaco (ver
// engine/GameEngine.ts#ZODIAC_LEVEL, duplicado aquí a propósito: este
// archivo no debe depender de GameEngine.ts).
const ZODIAC_SPEED_BOOST_LEVEL = 40;

/**
 * Multiplicador de velocidad del fondo — pedido explícito del usuario
 * (2026-07-22): "a partir del nivel 40, cuando aparecen las constelaciones
 * zodiacales más intensas y doradas, la velocidad del escenario de fondo...
 * debería ser mucho más rápido para dar la apariencia de que ya está en
 * otro nivel más alto". Centralizado aquí (en vez de duplicar la fórmula en
 * `ParallaxBackground.update()` y en `GameEngine.ts` para la capa del
 * zodiaco) para que el fondo lejano y las constelaciones siempre se muevan
 * exactamente a la misma velocidad entre sí.
 */
export function getBackgroundSpeedMultiplier(level: number): number {
  if (level < ZODIAC_SPEED_BOOST_LEVEL) {
    // Antes del nivel 40: rampa suave hasta 2.2x — sigue siendo "fondo",
    // sin competir visualmente con las entidades del primer plano.
    return Math.min(2.2, 1 + level * 0.025);
  }
  // Nivel 40+: rampa mucho más agresiva desde el 2.2x ya alcanzado, hasta
  // un techo de 6x — la sensación clara de "esto ya es otro nivel".
  const extraLevels = level - ZODIAC_SPEED_BOOST_LEVEL;
  return Math.min(6, 2.2 + extraLevels * 0.08);
}

export class ParallaxBackground {
  private stars: TilingSprite; // estrellas fijas — estática, no se desplaza (ver AGENTS.md §4)
  private decor: TilingSprite; // constelaciones/galaxias lejanas
  private planets: TilingSprite; // planetas de fondo aleatorios

  constructor(renderer: Renderer, width: number, height: number) {
    const starsTexture = buildStarfieldTexture(renderer, 512, 90, [0xc9cfff, 0xffffff]);
    const decorTexture = buildDecorTexture(renderer, 1200);
    const planetsTexture = buildBackgroundPlanetsTexture(renderer, 900);

    this.stars = new TilingSprite({ texture: starsTexture, width, height });
    this.decor = new TilingSprite({ texture: decorTexture, width, height });
    this.planets = new TilingSprite({ texture: planetsTexture, width, height });
  }

  get layers() {
    return [this.stars, this.decor, this.planets];
  }

  resize(width: number, height: number) {
    this.stars.width = width;
    this.stars.height = height;
    this.decor.width = width;
    this.decor.height = height;
    this.planets.width = width;
    this.planets.height = height;
  }

  update(deltaMS: number, level = 0) {
    // Ver `getBackgroundSpeedMultiplier()` arriba — la velocidad del fondo
    // sube con el nivel, mucho más agresivamente a partir del nivel 40.
    const speedMultiplier = getBackgroundSpeedMultiplier(level);
    // Estrellas fijas: sin scroll a propósito (ver AGENTS.md §4 "estático").
    this.decor.tilePosition.x -= (deltaMS / 1000) * 22 * speedMultiplier; // constelaciones/galaxias/nebulosas — lento
    this.planets.tilePosition.x -= (deltaMS / 1000) * 46 * speedMultiplier; // planetas de fondo — medio, más rápido que antes
  }
}
