import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/admin/feedback/:id/read — marca (o desmarca) un comentario
 * como leído. "Leído" = baja lógica (ver lib/schemas/feedback.ts): nunca
 * borra el documento de Mongo, solo lo saca del filtro por defecto del
 * listado — el checkbox "incluir ya leídos" en el admin lo vuelve a
 * mostrar. Body opcional `{read: boolean}` — sin body, alterna el valor
 * actual (toggle), para poder deshacer un "marcar como leído" por error.
 */
const BodySchema = z.object({ read: z.boolean() }).partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido", code: "INVALID_ID" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  const db = await getDb();
  const feedbackId = new ObjectId(id);

  let nextRead: boolean;
  if (parsed.success && typeof parsed.data.read === "boolean") {
    nextRead = parsed.data.read;
  } else {
    const current = await db.collection("feedback").findOne({ _id: feedbackId }, { projection: { read: 1 } });
    if (!current) {
      return NextResponse.json({ error: "Comentario no encontrado", code: "FEEDBACK_NOT_FOUND" }, { status: 404 });
    }
    nextRead = !current.read;
  }

  await db
    .collection("feedback")
    .updateOne({ _id: feedbackId }, { $set: { read: nextRead, readAt: nextRead ? new Date() : null } });

  logger.info({ adminId: guard.session.user.id, feedbackId: id, read: nextRead }, "admin.feedback.read_toggled");
  return NextResponse.json({ read: nextRead });
}
