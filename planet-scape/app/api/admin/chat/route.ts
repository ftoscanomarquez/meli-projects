import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import type { Filter, Document } from "mongodb";

/**
 * GET /api/admin/chat?roomId=&alias=&flaggedOnly=&from=&to= — búsqueda del
 * histórico de chat (ver AGENTS.md §6.6): "un administrador podrá buscar en
 * las conversaciones cosas sospechosas... deben marcarse como
 * conversaciones prioritarias a revisar". Los mensajes marcados
 * (`flagged: true` por lib/chatModeration.ts) se ordenan primero para que
 * el admin los vea sin tener que hojear todo el histórico.
 */
export async function GET(request: Request) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const params = new URL(request.url).searchParams;
  const roomId = params.get("roomId");
  const alias = params.get("alias");
  const flaggedOnly = params.get("flaggedOnly") === "true";
  const from = params.get("from");
  const to = params.get("to");

  const filter: Filter<Document> = {};
  if (roomId) filter.roomId = roomId;
  if (alias) filter.displayName = { $regex: alias, $options: "i" };
  if (flaggedOnly) filter.flagged = true;
  if (from || to) {
    filter.sentAt = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }

  const db = await getDb();
  // Prioridad de revisión: marcados primero, luego más recientes.
  const docs = await db
    .collection("chat_messages")
    .find(filter)
    .sort({ flagged: -1, sentAt: -1 })
    .limit(300)
    .toArray();

  const messages = docs.map((d) => ({
    id: String(d._id),
    roomId: String(d.roomId ?? ""),
    playerId: String(d.playerId ?? ""),
    displayName: String(d.displayName ?? ""),
    message: String(d.message ?? ""),
    sentAt: d.sentAt ?? new Date(),
    flagged: Boolean(d.flagged),
    flagReasons: Array.isArray(d.flagReasons) ? d.flagReasons : [],
  }));

  return NextResponse.json({ messages });
}
