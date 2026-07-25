import { getDb } from "@/lib/db";
import type { RoomLeaderboardEntry } from "@/lib/schemas/roomLeaderboard";

export type RoomLeaderboardRow = RoomLeaderboardEntry;

type RoomParticipant = { playerId: string; displayName: string; planet: string; isLeader: boolean };

/**
 * Registra/actualiza el récord de una sala — ver AGENTS.md §8 y
 * app/api/sessions/complete/route.ts (único llamador). Nunca baja el
 * `level` guardado; siempre agrega/actualiza al jugador dentro de
 * `participants` (por `playerId`, para no duplicarlo si reporta más de una
 * vez en la misma sala — ej. juega, muere, y su compañero sigue jugando).
 */
export async function upsertRoomLeaderboard(roomId: string, level: number, participant: RoomParticipant): Promise<void> {
  const db = await getDb();
  const collection = db.collection("room_leaderboard");
  const existing = await collection.findOne({ roomId });

  if (!existing) {
    await collection.insertOne({
      roomId,
      level,
      participants: [participant],
      achievedAt: new Date(),
    });
    return;
  }

  const participants = (existing.participants as RoomParticipant[]) ?? [];
  const otherParticipants = participants.filter((p) => p.playerId !== participant.playerId);
  const nextParticipants = [...otherParticipants, participant].slice(-4);

  const nextLevel = Math.max(existing.level ?? 0, level);
  await collection.updateOne(
    { roomId },
    {
      $set: {
        level: nextLevel,
        participants: nextParticipants,
        // Solo se actualiza `achievedAt` si de verdad se superó el récord
        // previo — mismo criterio que el leaderboard individual.
        ...(level > (existing.level ?? 0) ? { achievedAt: new Date() } : {}),
      },
    },
  );
}

/** Lectura directa a Mongo desde Server Component — ver AGENTS.md §12 regla 6. */
export async function getTopRoomLeaderboard(limit = 5): Promise<RoomLeaderboardRow[]> {
  const db = await getDb();
  const rows = await db
    .collection("room_leaderboard")
    .find({}, { projection: { _id: 0 } })
    .sort({ level: -1 })
    .limit(limit)
    .toArray();
  return rows as unknown as RoomLeaderboardRow[];
}
