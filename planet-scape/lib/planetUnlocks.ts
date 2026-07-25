import type { PremiumPlanetKey } from "@/engine/characterSvg";

/**
 * Costos de desbloqueo de planetas premium — ver AGENTS.md §5/§9 y feedback
 * real del usuario (2026-07-22): "Júpiter requiere 1000 estrellas, Saturno
 * 1200". Neptuno agregado 2026-07-23 — el más caro (3500 ⭐), pedido
 * explícito del usuario: "es el de los mas caros". Módulo compartido
 * cliente/servidor (solo datos, sin dependencias de Node) — la landing lo
 * usa para mostrar el costo, la ruta de desbloqueo lo usa como fuente de
 * verdad para validar.
 */
export const PLANET_UNLOCK_COSTS: Record<PremiumPlanetKey, number> = {
  jupiter: 1000,
  saturn: 1200,
  neptune: 3500,
};
