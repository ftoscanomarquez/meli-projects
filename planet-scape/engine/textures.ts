import { Graphics, Texture, type Renderer } from "pixi.js";
import { getPlanetSvgDataUri, type PlanetKey } from "./characterSvg";
import { createSeededRng } from "./rng";

/**
 * Texturas generadas una sola vez al iniciar la partida y cacheadas — ver
 * AGENTS.md §4 (formas geoides no circulares, nunca círculos perfectos).
 * Semilla fija por índice (no la del multijugador): son solo las formas
 * visuales base, no afectan el estado de física sincronizado.
 */

function buildAsteroidGraphics(seed: number): Graphics {
  const rng = createSeededRng(seed);
  const vertexCount = 8 + Math.floor(rng() * 7); // 8-14, ver AGENTS.md §4
  const baseRadius = 42;
  const cx = baseRadius + 12;
  const cy = baseRadius + 12;

  const points: number[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2;
    const jitter = 0.62 + rng() * 0.58; // 0.62-1.2 del radio base
    const r = baseRadius * jitter;
    points.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }

  const g = new Graphics();
  g.poly(points, true).fill(0x8a7566).stroke({ width: 3, color: 0x4a3a2c });

  // cráteres/sombras para textura, no un círculo liso
  for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * baseRadius * 0.55;
    g.circle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 4 + rng() * 7).fill({
      color: 0x5c4a3a,
      alpha: 0.55,
    });
  }

  return g;
}

export type EngineTextures = {
  asteroids: Texture[];
  pulsarSmall: Texture;
  pulsarLarge: Texture;
  star: Texture;
};

export function buildEngineTextures(renderer: Renderer): EngineTextures {
  const asteroids = Array.from({ length: 8 }, (_, i) =>
    renderer.generateTexture(buildAsteroidGraphics(i * 7919 + 13)),
  );

  const pulsar = (radius: number, color: number) => {
    const g = new Graphics()
      .circle(radius + 6, radius + 6, radius)
      .fill({ color, alpha: 0.35 })
      .circle(radius + 6, radius + 6, radius * 0.55)
      .fill(color);
    return renderer.generateTexture(g);
  };

  // Estrella de David (hexagrama) — moneda del juego, ver AGENTS.md §5.1.
  const starGraphics = new Graphics();
  const starPoints = (rotationDeg: number) => {
    const pts: number[] = [];
    for (let i = 0; i < 3; i++) {
      const angle = (rotationDeg + i * 120) * (Math.PI / 180);
      pts.push(30 + Math.cos(angle) * 26, 30 + Math.sin(angle) * 26);
      const angle2 = (rotationDeg + i * 120 + 60) * (Math.PI / 180);
      pts.push(30 + Math.cos(angle2) * 11, 30 + Math.sin(angle2) * 11);
    }
    return pts;
  };
  starGraphics
    .poly(starPoints(-90), true)
    .fill(0xffd54a)
    .poly(starPoints(-30), true)
    .fill(0xffd54a)
    .stroke({ width: 2, color: 0xaa7a10 });

  return {
    asteroids,
    pulsarSmall: pulsar(14, 0x7ce0ff),
    pulsarLarge: pulsar(22, 0x5ab8ff),
    star: renderer.generateTexture(starGraphics),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function loadPlanetTexture(planet: PlanetKey): Promise<Texture> {
  const img = await loadImage(getPlanetSvgDataUri(planet));
  return Texture.from(img);
}
