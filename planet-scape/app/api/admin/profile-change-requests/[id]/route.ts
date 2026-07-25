import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { UpdateProfileChangeRequestSchema } from "@/lib/schemas/profileChangeRequest";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/admin/profile-change-requests/:id — el admin resuelve una
 * solicitud de cambio de datos sensibles (ver AGENTS.md §6.8). Esta ruta
 * NUNCA aplica el cambio de datos en sí — solo notifica al jugador (in-app,
 * reutilizando `notifications`, mismo patrón que las denuncias). Aplicar el
 * cambio real (si el admin decide aprobarlo) se hace aparte, a mano, desde
 * `AdminPlayerSearch.tsx` — separar ambos pasos deja rastro de que un
 * humano revisó y decidió, no un "aprobar" que dispara el cambio solo.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido", code: "INVALID_ID" }, { status: 400 });
  }

  const parsed = UpdateProfileChangeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", code: "INVALID_BODY" }, { status: 400 });
  }

  const db = await getDb();
  const requestId = new ObjectId(id);
  const changeRequest = await db.collection("profile_change_requests").findOne({ _id: requestId });
  if (!changeRequest) {
    return NextResponse.json({ error: "Solicitud no encontrada", code: "REQUEST_NOT_FOUND" }, { status: 404 });
  }

  const { status, adminReply } = parsed.data;
  const now = new Date();

  await db.collection("profile_change_requests").updateOne(
    { _id: requestId },
    {
      $set: {
        status,
        adminReply: adminReply ?? changeRequest.adminReply ?? null,
        resolvedAt: status === "approved" || status === "rejected" ? now : changeRequest.resolvedAt ?? null,
        resolvedByAdminId:
          status === "approved" || status === "rejected" ? guard.session.user.id : changeRequest.resolvedByAdminId ?? null,
      },
    },
  );

  if (adminReply) {
    await db.collection("notifications").insertOne({
      playerId: changeRequest.playerId,
      message: adminReply,
      kind: "admin_reply",
      read: false,
      createdAt: now,
    });
  }

  logger.info({ adminId: guard.session.user.id, requestId: id, status }, "admin.profile_change_request.updated");
  return NextResponse.json({ ok: true, status });
}
