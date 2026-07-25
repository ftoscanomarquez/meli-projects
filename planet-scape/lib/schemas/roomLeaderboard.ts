import { z } from "zod";

/**
 * Top 5 de salas/equipos (2026-07-23, ver AGENTS.md §8) — pedido explícito
 * del usuario: "debe de haber un top 5 de los equipos o sala y marcar hasta
 * que nivel llegamos como record y deben aparecer las imagenes de los
 * participantes o planetas que lograron ese record". Un documento por
 * `roomId`, actualizado cada vez que un jugador de esa sala reporta su
 * resultado (ver /api/sessions/complete) — `level` es el máximo alcanzado
 * por CUALQUIER integrante del equipo (con el nivel ya sincronizado en vivo
 * entre compañeros, ver GameEngine.ts#onTeamProgress, todos deberían llegar
 * a un nivel similar de todas formas), `participants` es la unión de todos
 * los jugadores que reportaron resultado en esa sala.
 */
export const RoomParticipantSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  planet: z.string(),
  // El jugador que creó la sala — pedido explícito del usuario (2026-07-23):
  // "de nombre debe de salir el alias del lider... solo resalta el del
  // lider" en el widget del Top 5 (ver RoomLeaderboardWidget.tsx).
  isLeader: z.boolean().default(false),
});

export const RoomLeaderboardEntrySchema = z.object({
  roomId: z.string(),
  level: z.number().int().nonnegative(),
  participants: z.array(RoomParticipantSchema).max(4),
  achievedAt: z.date(),
});

export type RoomLeaderboardEntry = z.infer<typeof RoomLeaderboardEntrySchema>;
