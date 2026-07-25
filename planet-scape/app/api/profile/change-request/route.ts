import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CreateProfileChangeRequestSchema } from "@/lib/schemas/profileChangeRequest";
import { logger } from "@/lib/logger";

/**
 * POST /api/profile/change-request — el jugador solicita corregir un dato
 * sensible (nombre/apellido/fecha de nacimiento/correo principal) que no
 * puede editar directamente — pedido explícito del usuario (2026-07-22, ver
 * AGENTS.md §6.8): "deben contactarnos colocando sus datos y el porqué...
 * se les puede pedir algunos documentos para comprobar que su cuenta les
 * pertenece". Esta ruta SOLO registra la solicitud — nunca aplica el
 * cambio; un admin la revisa manualmente y, si procede, aplica el cambio él
 * mismo desde el panel (AdminPlayerSearch.tsx).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = CreateProfileChangeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const db = await getDb();
  await db.collection("profile_change_requests").insertOne({
    playerId: session.user.id,
    requesterDisplayName: session.user.displayName,
    requesterEmail: session.user.email ?? "",
    fields: parsed.data.fields,
    requestedValues: parsed.data.requestedValues,
    justification: parsed.data.justification,
    status: "pending",
    createdAt: new Date(),
    adminReply: null,
    resolvedAt: null,
    resolvedByAdminId: null,
  });

  logger.info({ playerId: session.user.id, fields: parsed.data.fields }, "profile.change_request.submitted");
  return NextResponse.json({ ok: true });
}
