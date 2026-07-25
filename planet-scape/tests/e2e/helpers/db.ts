import { MongoClient, ObjectId } from "mongodb";

/**
 * Limpieza de datos de prueba (Fase 9) — ver AGENTS.md §11. Todos los
 * emails de prueba usan el prefijo `e2e-` (ver `uniqueTestEmail`), así que
 * la limpieza nunca toca cuentas reales de Francisco/Meli u otros jugadores.
 */
export async function cleanupE2eTestData(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? "mongodb://admin:magiclink123@localhost:27019/?authSource=admin";
  const dbName = process.env.MONGODB_DB ?? "planet_scape";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const players = await db.collection("players").find({ email: { $regex: "^e2e-" } }).toArray();
    const ids: ObjectId[] = players.map((p) => p._id);
    if (ids.length === 0) return;

    await Promise.all([
      db.collection("players").deleteMany({ _id: { $in: ids } }),
      db.collection("star_transactions").deleteMany({ playerId: { $in: ids } }),
      db.collection("game_sessions").deleteMany({ playerId: { $in: ids } }),
      db.collection("leaderboard").deleteMany({ playerId: { $in: ids } }),
      db.collection("donations").deleteMany({ playerId: { $in: ids.map((id) => id.toString()) } }),
      db.collection("sessions").deleteMany({ userId: { $in: ids } }),
      db.collection("verification_tokens").deleteMany({ identifier: { $regex: "^e2e-" } }),
    ]);
  } finally {
    await client.close();
  }
}
