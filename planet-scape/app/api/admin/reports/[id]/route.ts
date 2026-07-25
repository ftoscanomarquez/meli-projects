import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { UpdateReportRequestSchema } from "@/lib/schemas/report";
import { logger } from "@/lib/logger";

// A la 3ª amonestación se inhabilita la cuenta — pedido explícito del
// usuario (2026-07-22, ver AGENTS.md §6.6): "solo habrá dos avisos o
// amonestaciones y a la tercera amonestación se inhabilita la cuenta".
const MAX_STRIKES_BEFORE_BAN = 3;

/**
 * PATCH /api/admin/reports/:id — el admin resuelve una denuncia (ver
 * AGENTS.md §6.6). Solo el admin decide si procede tras revisar
 * manualmente el histórico de chat (AdminChatPanel) — esta ruta nunca se
 * dispara automáticamente.
 *
 * Transiciones:
 * - "reviewing" (+ `adminReply` opcional): notifica al denunciante que su
 *   solicitud está siendo atendida, sin tocar al denunciado todavía.
 * - "approved": incrementa `players.strikes` del denunciado en +1. Si llega
 *   a `MAX_STRIKES_BEFORE_BAN`, marca `players.banned = true` (bloquea toda
 *   la app, ver BannedGate.tsx) — si no, solo notifica la amonestación.
 * - "rejected": no toca al denunciado; puede llevar `adminReply` explicando
 *   el motivo al denunciante.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido", code: "INVALID_ID" }, { status: 400 });
  }

  const parsed = UpdateReportRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", code: "INVALID_BODY" }, { status: 400 });
  }

  const db = await getDb();
  const reportId = new ObjectId(id);
  const report = await db.collection("reports").findOne({ _id: reportId });
  if (!report) {
    return NextResponse.json({ error: "Denuncia no encontrada", code: "REPORT_NOT_FOUND" }, { status: 404 });
  }

  const { status, adminReply } = parsed.data;
  const now = new Date();

  await db.collection("reports").updateOne(
    { _id: reportId },
    {
      $set: {
        status,
        adminReply: adminReply ?? report.adminReply ?? null,
        resolvedAt: status === "approved" || status === "rejected" ? now : report.resolvedAt ?? null,
        resolvedByAdminId: status === "approved" || status === "rejected" ? guard.session.user.id : report.resolvedByAdminId ?? null,
      },
    },
  );

  // "tu solicitud será atendida" — pedido explícito del usuario (ver
  // AGENTS.md §6.6) — cualquier transición con adminReply notifica al
  // denunciante, independiente del status (reviewing/approved/rejected).
  if (adminReply) {
    await db.collection("notifications").insertOne({
      playerId: report.reporterId,
      message: adminReply,
      kind: "admin_reply",
      read: false,
      createdAt: now,
    });
  }

  let banned = false;
  let newStrikeCount: number | null = null;

  if (status === "approved" && report.reportedPlayerId) {
    const reportedId = new ObjectId(report.reportedPlayerId);
    const updated = await db
      .collection("players")
      .findOneAndUpdate({ _id: reportedId }, { $inc: { strikes: 1 } }, { returnDocument: "after" });
    newStrikeCount = updated?.strikes ?? null;

    if (newStrikeCount !== null && newStrikeCount >= MAX_STRIKES_BEFORE_BAN) {
      banned = true;
      await db.collection("players").updateOne({ _id: reportedId }, { $set: { banned: true } });
      await db.collection("notifications").insertOne({
        playerId: report.reportedPlayerId,
        message:
          "Tu cuenta ha sido inhabilitada tras recibir 3 amonestaciones por acoso/lenguaje inapropiado hacia otros jugadores.",
        kind: "account_banned",
        read: false,
        createdAt: now,
      });
    } else if (newStrikeCount !== null) {
      const remaining = MAX_STRIKES_BEFORE_BAN - newStrikeCount;
      await db.collection("notifications").insertOne({
        playerId: report.reportedPlayerId,
        message: `Has recibido una amonestación (${newStrikeCount}/${MAX_STRIKES_BEFORE_BAN}) por acoso/lenguaje inapropiado hacia otro jugador. ${remaining === 1 ? "Una amonestación más y tu cuenta será inhabilitada permanentemente." : `Te quedan ${remaining} amonestaciones antes de que tu cuenta sea inhabilitada.`}`,
        kind: "strike_warning",
        read: false,
        createdAt: now,
      });
    }

    logger.warn(
      { adminId: guard.session.user.id, reportId: id, reportedPlayerId: report.reportedPlayerId, newStrikeCount, banned },
      "admin.report.approved_strike_issued",
    );
  }

  logger.info({ adminId: guard.session.user.id, reportId: id, status }, "admin.report.updated");
  return NextResponse.json({ ok: true, status, newStrikeCount, banned });
}
