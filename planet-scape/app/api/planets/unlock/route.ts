import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isPremiumPlanetKey } from "@/engine/characterSvg";
import { PLANET_UNLOCK_COSTS } from "@/lib/planetUnlocks";
import { logger } from "@/lib/logger";

const UnlockPlanetRequestSchema = z.object({ planet: z.string() });

// POST /api/planets/unlock — ver AGENTS.md §5/§9 y feedback real del
// usuario (2026-07-22): Júpiter (1000 ⭐) y Saturno (1200 ⭐). Redime
// estrellas de forma permanente (`players.unlockedPlanets`), con
// `star_transaction` de auditoría (`reason: "planet_unlock"`, monto
// negativo) — mismo patrón que el resto de movimientos de estrellas del
// proyecto. Idempotente: si ya estaba desbloqueado, no vuelve a cobrar.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UnlockPlanetRequestSchema.safeParse(body);
  if (!parsed.success || !isPremiumPlanetKey(parsed.data.planet)) {
    return NextResponse.json({ error: "Planeta inválido", code: "INVALID_PLANET" }, { status: 400 });
  }
  const planet = parsed.data.planet;
  const cost = PLANET_UNLOCK_COSTS[planet];

  const db = await getDb();
  const playerId = new ObjectId(session.user.id);
  const player = await db.collection("players").findOne({ _id: playerId }, { projection: { stars: 1, unlockedPlanets: 1 } });
  if (!player) {
    return NextResponse.json({ error: "Jugador no encontrado", code: "PLAYER_NOT_FOUND" }, { status: 404 });
  }

  const alreadyUnlocked: string[] = player.unlockedPlanets ?? [];
  if (alreadyUnlocked.includes(planet)) {
    return NextResponse.json({ unlocked: true, stars: player.stars ?? 0, alreadyOwned: true });
  }

  const currentStars: number = player.stars ?? 0;
  if (currentStars < cost) {
    return NextResponse.json(
      { error: "Estrellas insuficientes", code: "INSUFFICIENT_STARS", stars: currentStars, cost },
      { status: 400 },
    );
  }

  const newStars = currentStars - cost;
  await db.collection("star_transactions").insertOne({
    playerId,
    amount: -cost,
    reason: "planet_unlock",
    createdAt: new Date(),
  });
  await db.collection("players").updateOne({ _id: playerId }, { $set: { stars: newStars }, $addToSet: { unlockedPlanets: planet } });

  logger.info({ playerId: session.user.id, planet, cost }, "planets.unlock.purchased");

  return NextResponse.json({ unlocked: true, stars: newStars, alreadyOwned: false });
}
