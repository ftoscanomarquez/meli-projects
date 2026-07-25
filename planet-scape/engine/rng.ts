/**
 * Generador con semilla — ver AGENTS.md §8 (multijugador determinista).
 * Todos los clientes de una misma sala reciben el mismo `seed` del servidor
 * de PartyKit y generan asteroides/Sol/agujero negro idénticos sin que el
 * servidor tenga que simular física — ver RETROSPECTIVA.md.
 */
export type Rng = () => number;

export function createSeededRng(seed: number): Rng {
  let s = seed | 0;
  return function random() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla real (no determinista) — partidas en solitario sin sala compartida. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
