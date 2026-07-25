import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import type { ProfileChangeRequest } from "@/lib/schemas/profileChangeRequest";

/**
 * GET /api/admin/profile-change-requests?status=pending — ver AGENTS.md
 * §6.8. Por defecto solo las que requieren atención (pending/reviewing) —
 * mismo criterio que /api/admin/reports.
 */
export async function GET(request: Request) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const status = new URL(request.url).searchParams.get("status");
  const filter = status ? { status } : { status: { $in: ["pending", "reviewing"] } };

  const db = await getDb();
  const docs = await db
    .collection("profile_change_requests")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const requests: (ProfileChangeRequest & { id: string })[] = docs.map((d) => ({
    id: String(d._id),
    playerId: String(d.playerId ?? ""),
    requesterDisplayName: String(d.requesterDisplayName ?? ""),
    requesterEmail: String(d.requesterEmail ?? ""),
    fields: Array.isArray(d.fields) ? d.fields : [],
    requestedValues: String(d.requestedValues ?? ""),
    justification: String(d.justification ?? ""),
    status: d.status ?? "pending",
    createdAt: d.createdAt ?? new Date(),
    adminReply: d.adminReply ?? null,
    resolvedAt: d.resolvedAt ?? null,
    resolvedByAdminId: d.resolvedByAdminId ?? null,
  }));

  return NextResponse.json({ requests });
}
