import { getDb } from "@/lib/db";

export type LeaderboardRow = {
  displayName: string;
  bestScore: number;
  levelReached: number;
  // Con qué planeta se logró — puede faltar en entradas de antes de este
  // campo (ver AGENTS.md §2.3), el widget debe manejar `undefined`.
  planet?: string;
  // Fecha en que se logró el récord — pedido explícito del usuario
  // (2026-07-23): "debe salir en ambos ranking la fecha en que se alcanzo
  // dicho record". Opcional por compatibilidad con entradas anteriores a
  // este campo (siempre existió en el esquema, pero por si acaso).
  achievedAt?: Date;
};

/** Lectura directa a Mongo desde Server Component — ver AGENTS.md §12 regla 6. */
export async function getTopLeaderboard(limit = 10): Promise<LeaderboardRow[]> {
  const db = await getDb();
  const rows = await db
    .collection("leaderboard")
    .find({}, { projection: { _id: 0, playerId: 0 } })
    .sort({ bestScore: -1 })
    .limit(limit)
    .toArray();
  return rows as unknown as LeaderboardRow[];
}
