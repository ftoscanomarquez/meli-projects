import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/players/delete — elimina una o varias cuentas de jugador
 * de un solo golpe (pedido explícito del usuario, 2026-07-22: "debe
 * permitirme seleccionar varios jugadores para eliminar en el caso de
 * pruebas"). Borra también sus datos relacionados (sesiones, transacciones
 * de estrellas, entrada de leaderboard) para no dejar huérfanos — mismo
 * criterio de limpieza usado manualmente durante todo el desarrollo de este
 * proyecto vía mongosh. Un admin nunca puede borrarse a sí mismo por
 * accidente (ver guarda abajo) — evita quedarse sin acceso al panel.
 */
const DeletePlayersRequestSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export async function POST(request: Request) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const parsed = DeletePlayersRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", code: "INVALID_BODY" }, { status: 400 });
  }

  const validIds = parsed.data.ids.filter((id) => ObjectId.isValid(id));
  const ownId = guard.session.user.id;
  const targetIds = validIds.filter((id) => id !== ownId).map((id) => new ObjectId(id));

  if (targetIds.length === 0) {
    return NextResponse.json(
      { error: "No hay jugadores válidos para eliminar (no puedes eliminarte a ti mismo)", code: "NO_VALID_TARGETS" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const [players, sessions, transactions, leaderboard] = await Promise.all([
    db.collection("players").deleteMany({ _id: { $in: targetIds } }),
    db.collection("game_sessions").deleteMany({ playerId: { $in: targetIds } }),
    db.collection("star_transactions").deleteMany({ playerId: { $in: targetIds } }),
    db.collection("leaderboard").deleteMany({ playerId: { $in: targetIds } }),
  ]);

  logger.info(
    {
      adminId: ownId,
      deletedPlayers: players.deletedCount,
      deletedSessions: sessions.deletedCount,
      deletedTransactions: transactions.deletedCount,
      deletedLeaderboardEntries: leaderboard.deletedCount,
    },
    "admin.players.deleted",
  );

  return NextResponse.json({ deletedCount: players.deletedCount });
}
