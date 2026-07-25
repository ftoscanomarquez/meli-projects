import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import type { FeedbackEntry } from "@/lib/schemas/feedback";

/**
 * GET /api/admin/feedback?includeRead=true|false — ver AGENTS.md §2.3. Por
 * defecto solo muestra los NO leídos (baja lógica activa) — pedido
 * explícito del usuario: "debe haber un checkbox que te permita habilitar
 * búsqueda incluidos los ya leídos, para que te aparezcan aunque estén
 * marcados como baja lógica".
 */
export async function GET(request: Request) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const includeRead = new URL(request.url).searchParams.get("includeRead") === "true";
  const db = await getDb();
  const docs = await db
    .collection("feedback")
    .find(includeRead ? {} : { read: false })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const entries: FeedbackEntry[] = docs.map((d) => ({
    id: String(d._id),
    playerId: String(d.playerId ?? ""),
    displayName: String(d.displayName ?? ""),
    email: String(d.email ?? ""),
    message: String(d.message ?? ""),
    sentiment: d.sentiment === "positive" || d.sentiment === "negative" ? d.sentiment : "neutral",
    read: Boolean(d.read),
    createdAt: d.createdAt ?? new Date(),
    readAt: d.readAt ?? null,
  }));

  return NextResponse.json({ entries });
}
