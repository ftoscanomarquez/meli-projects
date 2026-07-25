import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { AdjustStarsRequestSchema } from "@/lib/schemas/admin";
import { logger } from "@/lib/logger";

// PATCH /api/admin/players/:id/stars — ver AGENTS.md §9. Ajuste manual con
// `star_transaction` de auditoría (`reason: "admin_adjustment"`), nunca un
// `$set` directo sin rastro — mismo patrón que el resto de movimientos de
// estrellas del proyecto (gameplay, donation_reward).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID de jugador inválido", code: "INVALID_PLAYER_ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AdjustStarsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ajuste inválido", code: "INVALID_AMOUNT" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const playerId = new ObjectId(id);
  const player = await db.collection("players").findOne({ _id: playerId }, { projection: { stars: 1 } });
  if (!player) {
    return NextResponse.json({ error: "Jugador no encontrado", code: "PLAYER_NOT_FOUND" }, { status: 404 });
  }

  const newStars = Math.max(0, (player.stars ?? 0) + parsed.data.amount);

  await db.collection("star_transactions").insertOne({
    playerId,
    amount: newStars - (player.stars ?? 0),
    reason: "admin_adjustment",
    createdAt: new Date(),
    adminId: new ObjectId(guard.session.user.id),
  });
  await db.collection("players").updateOne({ _id: playerId }, { $set: { stars: newStars } });

  logger.info({ adminId: guard.session.user.id, playerId: id, newStars }, "admin.player.stars_adjusted");

  return NextResponse.json({ stars: newStars });
}
