import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import type { Report } from "@/lib/schemas/report";

/**
 * GET /api/admin/reports?status=pending — panel de moderación (ver
 * AGENTS.md §6.6). Sin `status`, devuelve las denuncias que todavía
 * requieren atención (pending/reviewing) primero — las resueltas
 * (approved/rejected) solo se piden explícitamente, mismo espíritu que el
 * checkbox "incluir ya leídos" del panel de comentarios.
 */
export async function GET(request: Request) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const status = new URL(request.url).searchParams.get("status");
  const filter = status ? { status } : { status: { $in: ["pending", "reviewing"] } };

  const db = await getDb();
  const docs = await db.collection("reports").find(filter).sort({ createdAt: -1 }).limit(200).toArray();

  const reports: (Report & { id: string })[] = docs.map((d) => ({
    id: String(d._id),
    reporterId: String(d.reporterId ?? ""),
    reporterDisplayName: String(d.reporterDisplayName ?? ""),
    reportedAlias: String(d.reportedAlias ?? ""),
    reportedPlayerId: d.reportedPlayerId ?? null,
    incidentAt: d.incidentAt ?? new Date(),
    roomId: d.roomId ?? null,
    description: String(d.description ?? ""),
    status: d.status ?? "pending",
    createdAt: d.createdAt ?? new Date(),
    adminReply: d.adminReply ?? null,
    resolvedAt: d.resolvedAt ?? null,
    resolvedByAdminId: d.resolvedByAdminId ?? null,
  }));

  return NextResponse.json({ reports });
}
