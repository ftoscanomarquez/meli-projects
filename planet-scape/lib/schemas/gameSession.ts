import { z } from "zod";

/**
 * Ver SPECIFICATION-SUMMARY.md §3. Payload que el cliente envía al terminar
 * una partida (Fase 6) — validado en /api/sessions/complete.
 */
export const CompleteSessionRequestSchema = z.object({
  planet: z.enum(["mercury", "venus", "earth", "mars", "jupiter", "saturn", "neptune"]),
  level: z.number().int().nonnegative(),
  // Total de estrellas de TODA la partida — se usa para el historial
  // (game_sessions) y el puntaje del leaderboard, NUNCA para incrementar
  // `players.stars` directo (eso ya lo hace `starsToCredit`, ver abajo) —
  // evita contar dos veces las que ya se guardaron en vivo.
  starsCollected: z.number().int().nonnegative(),
  // Guardado incremental cada 5 estrellas (2026-07-22, ver AGENTS.md §7.3 y
  // app/api/sessions/star-increment/route.ts): cuántas de `starsCollected`
  // TODAVÍA no se le sumaron a `players.stars` (el resto ya se guardó en
  // vivo durante la partida). Opcional por compatibilidad — si no llega, se
  // asume que nada se guardó en vivo y se acredita `starsCollected` completo
  // (comportamiento original, antes de este cambio).
  starsToCredit: z.number().int().nonnegative().optional(),
  roomId: z.string().max(20).optional(), // presente solo si fue una partida multijugador
  // El jugador creó la sala (el primero en conectarse) — pedido explícito
  // del usuario (2026-07-23, ver AGENTS.md §8.2): resaltar su alias en el
  // Top 5 de equipos. Solo tiene sentido si `roomId` está presente.
  isLeader: z.boolean().optional(),
});

export type CompleteSessionRequest = z.infer<typeof CompleteSessionRequestSchema>;

// POST /api/sessions/star-increment — guardado silencioso cada 5 estrellas
// mientras se juega, para no perder todo el progreso de la partida si el
// juego se traba/cierra antes de llegar a game over (pedido explícito del
// usuario, 2026-07-22: "a lo más 5 [estrellas] que correspondan a cuando se
// haya trabado el juego").
export const StarIncrementRequestSchema = z.object({
  amount: z.number().int().positive().max(50), // múltiplos de 5, tope de saneamiento generoso
});

export const GameSessionSchema = z.object({
  _id: z.string().optional(),
  playerId: z.string(),
  roomId: z.string().nullable(),
  planet: z.string(),
  startedAt: z.date().optional(),
  endedAt: z.date(),
  levelReached: z.number().int().nonnegative(),
  starsCollected: z.number().int().nonnegative(),
});
