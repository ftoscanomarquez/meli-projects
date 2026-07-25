import { z } from "zod";

/**
 * Ver SPECIFICATION-SUMMARY.md §3. `bestScore` = `levelReached * 100 +
 * starsCollected` (ver lib/score.ts) — el nivel pesa mucho más que las
 * estrellas porque refleja la dificultad superada, no solo la recolección.
 */
export const LeaderboardEntrySchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  bestScore: z.number().int().nonnegative(),
  levelReached: z.number().int().nonnegative(),
  // Con qué planeta se logró el mejor puntaje — pedido explícito del
  // usuario (2026-07-22): "pon una imagen para saber con qué planeta logró
  // ese ranking". Opcional por compatibilidad con entradas de antes de este
  // cambio (no tenían este campo).
  planet: z.string().optional(),
  achievedAt: z.date(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
