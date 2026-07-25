import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CompleteSessionRequestSchema } from "@/lib/schemas/gameSession";
import { computeScore } from "@/lib/score";
import { logger } from "@/lib/logger";
import { upsertRoomLeaderboard } from "@/lib/roomLeaderboard";

// POST /api/sessions/complete — ver AGENTS.md §7 y SPECIFICATION-SUMMARY.md §4.
// Sesión de usuario (no secreto de servicio): cada jugador reporta su propio
// resultado al terminar su partida, solo/multijugador — ver AGENTS.md §8
// (vidas/estrellas son locales a cada dispositivo, no coordinadas por sala).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CompleteSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", code: "INVALID_BODY" }, { status: 400 });
  }

  // Límites razonables — el cliente reporta su propio resultado (sin
  // servidor de físicas autoritativo, ver AGENTS.md §8), así que se acotan
  // valores absurdos en vez de confiar ciegamente. No es anti-cheat real,
  // es una salvaguarda contra errores/payloads corruptos.
  const level = Math.min(parsed.data.level, 500);
  const starsCollected = Math.min(parsed.data.starsCollected, 1000);
  // Guardado incremental cada 5 estrellas (ver AGENTS.md §7.3): el cliente ya
  // le sumó una parte a `players.stars` en vivo durante la partida vía
  // /api/sessions/star-increment — aquí solo se acredita el RESTO, para no
  // contar dos veces las mismas estrellas. Si no llega (clientes viejos o
  // llamadas directas), se asume que nada se guardó en vivo.
  const starsToCredit = Math.min(parsed.data.starsToCredit ?? starsCollected, starsCollected);
  const { planet, roomId, isLeader } = parsed.data;

  const playerId = new ObjectId(session.user.id);
  const db = await getDb();
  const now = new Date();

  const sessionDoc = await db.collection("game_sessions").insertOne({
    playerId,
    roomId: roomId ?? null,
    planet,
    endedAt: now,
    levelReached: level,
    starsCollected,
  });

  if (starsToCredit > 0) {
    await db.collection("star_transactions").insertOne({
      playerId,
      amount: starsToCredit,
      reason: "gameplay",
      relatedSessionId: sessionDoc.insertedId,
      createdAt: now,
    });
  }

  const playersCollection = db.collection("players");
  await playersCollection.updateOne({ _id: playerId }, { $inc: { stars: starsToCredit } });
  const updatedPlayer = await playersCollection.findOne({ _id: playerId });
  const totalStars = updatedPlayer?.stars ?? starsToCredit;

  const score = computeScore(level, starsCollected);
  const existingEntry = await db.collection("leaderboard").findOne({ playerId });
  let leaderboardUpdated = false;
  if (!existingEntry || score > existingEntry.bestScore) {
    await db.collection("leaderboard").updateOne(
      { playerId },
      {
        $set: {
          playerId,
          displayName: session.user.displayName,
          bestScore: score,
          levelReached: level,
          planet, // ver AGENTS.md §2.3 — con qué planeta se logró este puntaje
          achievedAt: now,
        },
      },
      { upsert: true },
    );
    leaderboardUpdated = true;
  }

  // Top 5 de salas/equipos (2026-07-23, ver AGENTS.md §8) — pedido explícito
  // del usuario: "debe de haber un top 5 de los equipos o sala y marcar
  // hasta que nivel llegamos como record". Solo aplica si esta partida se
  // jugó en una sala real (`roomId`); el modo solo nunca tiene sala.
  if (roomId) {
    await upsertRoomLeaderboard(roomId, level, {
      playerId: session.user.id,
      displayName: session.user.displayName,
      planet,
      isLeader: isLeader ?? false,
    });
  }

  logger.info(
    { playerId: session.user.id, level, starsCollected, starsToCredit, score, leaderboardUpdated },
    "sessions.complete",
  );

  return NextResponse.json({ totalStars, score, leaderboardUpdated });
}
