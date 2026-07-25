import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { StarIncrementRequestSchema } from "@/lib/schemas/gameSession";
import { logger } from "@/lib/logger";

/**
 * POST /api/sessions/star-increment — guardado silencioso en vivo, cada 5
 * estrellas recolectadas durante la partida (ver GameEngine.ts, disparado
 * desde `checkAndCommitStars()`) — pedido explícito del usuario
 * (2026-07-22): si el juego se traba/reinicia a mitad de una partida larga
 * (ver el bug real documentado en RETROSPECTIVA.md), como mucho se pierden
 * las últimas 4 estrellas sin guardar, no todo el progreso de la partida.
 *
 * A diferencia de `/api/sessions/complete`, esto NO toca `game_sessions` ni
 * `leaderboard` — esos siguen siendo exclusivos del cierre real de la
 * partida (game over). Aquí solo se adelanta el saldo de `players.stars` +
 * su `star_transactions` de auditoría correspondiente, para que el cierre
 * final (`starsToCredit`) no vuelva a sumarlas.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = StarIncrementRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", code: "INVALID_BODY" }, { status: 400 });
  }

  const playerId = new ObjectId(session.user.id);
  const db = await getDb();
  const { amount } = parsed.data;

  await db.collection("star_transactions").insertOne({
    playerId,
    amount,
    reason: "gameplay",
    createdAt: new Date(),
  });
  const result = await db.collection("players").findOneAndUpdate(
    { _id: playerId },
    { $inc: { stars: amount } },
    { returnDocument: "after" },
  );

  logger.info({ playerId: session.user.id, amount }, "sessions.star_increment");
  return NextResponse.json({ totalStars: result?.stars ?? amount });
}
