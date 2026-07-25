import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CreateReportRequestSchema } from "@/lib/schemas/report";
import { logger } from "@/lib/logger";

/**
 * POST /api/reports — un jugador denuncia a otro por acoso/lenguaje
 * inapropiado — pedido explícito del usuario (2026-07-22, ver AGENTS.md
 * §6.6). Requiere sesión (para saber quién denuncia y poder notificarle la
 * resolución, ver /api/admin/reports/[id]). El admin es quien decide si
 * procede — esta ruta solo registra la denuncia en estado "pending", nunca
 * amonesta directamente.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = CreateReportRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Denuncia inválida", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const db = await getDb();
  // Intenta resolver el alias denunciado a un jugador real — no bloqueante:
  // si no se encuentra (typo, alias ya cambiado), la denuncia se guarda
  // igual con `reportedPlayerId: null` para que el admin investigue a mano
  // usando el roomId/fecha en `chat_messages`.
  const reportedPlayer = await db
    .collection("players")
    .findOne({ displayName: parsed.data.reportedAlias }, { projection: { _id: 1 } });

  await db.collection("reports").insertOne({
    reporterId: session.user.id,
    reporterDisplayName: session.user.displayName,
    reportedAlias: parsed.data.reportedAlias,
    reportedPlayerId: reportedPlayer ? String(reportedPlayer._id) : null,
    incidentAt: new Date(parsed.data.incidentAt),
    roomId: parsed.data.roomId ?? null,
    description: parsed.data.description,
    status: "pending",
    createdAt: new Date(),
    adminReply: null,
    resolvedAt: null,
    resolvedByAdminId: null,
  });

  logger.info(
    { reporterId: session.user.id, reportedAlias: parsed.data.reportedAlias },
    "reports.submitted",
  );
  return NextResponse.json({ ok: true });
}
