import { FieldObject, type FieldObjectKind } from "../entities/FieldObject";
import type { EngineTextures } from "../textures";
import type { Rng } from "../rng";

/**
 * Entrada desde cualquier punto de 360° alrededor del viewport — ver
 * AGENTS.md §5.1: "entran desde cualquier punto de 360 grados y a
 * distintas velocidades".
 */
function edgePointAndVelocity(width: number, height: number, speed: number, rng: Rng) {
  const angle = rng() * Math.PI * 2;
  const spawnRadius = Math.max(width, height) * 0.62;
  const cx = width / 2;
  const cy = height / 2;
  const x = cx + Math.cos(angle) * spawnRadius;
  const y = cy + Math.sin(angle) * spawnRadius;

  // Apunta hacia un punto aleatorio dentro del área visible, no siempre al centro exacto.
  const targetX = width * (0.2 + rng() * 0.6);
  const targetY = height * (0.2 + rng() * 0.6);
  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.hypot(dx, dy) || 1;

  return { x, y, vx: (dx / dist) * speed, vy: (dy / dist) * speed };
}

// Más variedad de tamaños (pedido real del usuario, 2026-07-22): tiers con
// probabilidad decreciente — la mayoría chicos/medianos y rápidos, los
// gigantes son raros y más lentos (más peso visual, menos frecuentes).
const ASTEROID_SIZE_TIERS: { weight: number; min: number; max: number }[] = [
  { weight: 0.38, min: 13, max: 22 }, // chicos
  { weight: 0.34, min: 22, max: 34 }, // medianos
  { weight: 0.2, min: 34, max: 50 }, // grandes
  { weight: 0.08, min: 50, max: 72 }, // gigantes, raros
];

function pickAsteroidRadius(rng: Rng): number {
  const roll = rng();
  let acc = 0;
  for (const tier of ASTEROID_SIZE_TIERS) {
    acc += tier.weight;
    if (roll <= acc) return tier.min + rng() * (tier.max - tier.min);
  }
  const last = ASTEROID_SIZE_TIERS[ASTEROID_SIZE_TIERS.length - 1];
  return last.min + rng() * (last.max - last.min);
}

export function spawnAsteroid(
  textures: EngineTextures,
  width: number,
  height: number,
  level: number,
  rng: Rng,
  scale = 1,
  // Ritmo relativo al tamaño real de pantalla (ver GameEngine.ts#paceScale)
  // — pedido explícito del usuario (2026-07-24): "en mobile salen mas [...]
  // y mas rapidos... me gustaria que el PC fuera igual de rapido". Solo
  // multiplica la VELOCIDAD (nunca cuántos números aleatorios se consumen
  // del `rng`, para no desincronizar el mundo compartido en multijugador —
  // GameEngine ya lo fija en 1 mientras hay multijugador, ver su comentario).
  paceScale = 1,
  // Rango base configurable desde /admin (2026-07-26, ver
  // lib/schemas/gameConfig.ts#asteroids) — antes 110/600 fijos en código.
  // Estos valores son la BASE, antes de `sizeSpeedFactor`/nivel/`paceScale`.
  minSpeedBase = 110,
  maxSpeedBonusBase = 600,
): FieldObject {
  const texture = textures.asteroids[Math.floor(rng() * textures.asteroids.length)];
  const radius = pickAsteroidRadius(rng) * scale;
  // Ritmo general más rápido y la dificultad sube más entre nivel y nivel
  // — feedback real del usuario (2026-07-22): "aún lo siento un poco
  // lento". Los chicos van más rápido que los gigantes (sensación de
  // variedad real, no solo visual).
  const sizeSpeedFactor = 1.35 - ((radius / scale - 13) / (72 - 13)) * 0.55;
  // El nivel sube el TECHO de velocidad, no desplaza todo el rango parejo
  // — feedback real del usuario (2026-07-22, nivel 30): "a mayor nivel más
  // dificultad y más velocidad no quiere decir que todos corren a máxima
  // velocidad, pero hay más variedad de velocidades — lo que se incrementa
  // entre nivel y nivel es el valor MÁXIMO". El mínimo se mantiene fijo
  // (configurable, ya no 110 hardcoded) para que sigan apareciendo
  // asteroides lentos incluso en niveles altos; el techo (`maxSpeedBonus`)
  // crece con el nivel hasta el tope configurable.
  const maxSpeedBonus = Math.min(maxSpeedBonusBase, level * 14);
  const speed = (minSpeedBase + rng() * (90 + maxSpeedBonus)) * sizeSpeedFactor * paceScale;
  const { x, y, vx, vy } = edgePointAndVelocity(width, height, speed, rng);
  return new FieldObject(texture, "asteroid", x, y, vx, vy, radius, rng);
}

export function spawnPulsar(
  textures: EngineTextures,
  width: number,
  height: number,
  large: boolean,
  rng: Rng,
  scale = 1,
): FieldObject {
  const texture = large ? textures.pulsarLarge : textures.pulsarSmall;
  const radius = (large ? 22 : 14) * scale;
  const speed = 90 + rng() * 50;
  const { x, y, vx, vy } = edgePointAndVelocity(width, height, speed, rng);
  const kind: FieldObjectKind = large ? "pulsarLarge" : "pulsarSmall";
  return new FieldObject(texture, kind, x, y, vx, vy, radius, rng);
}

export function spawnStar(textures: EngineTextures, width: number, height: number, rng: Rng, scale = 1): FieldObject {
  const speed = 80 + rng() * 50;
  const { x, y, vx, vy } = edgePointAndVelocity(width, height, speed, rng);
  return new FieldObject(textures.star, "star", x, y, vx, vy, 18 * scale, rng);
}
