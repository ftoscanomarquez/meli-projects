import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/notifications — notificaciones in-app del jugador de la sesión
 * actual (ver AGENTS.md §6.6, NotificationBell.tsx) — respuestas del admin
 * a una denuncia, avisos de amonestación. Solo las propias, nunca las de
 * otro jugador (filtradas por `playerId` de la sesión, no por un parámetro
 * de la URL que se pudiera manipular).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const db = await getDb();
  const docs = await db
    .collection("notifications")
    .find({ playerId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const notifications = docs.map((d) => ({
    id: String(d._id),
    message: String(d.message ?? ""),
    kind: d.kind ?? "admin_reply",
    read: Boolean(d.read),
    createdAt: d.createdAt ?? new Date(),
  }));

  return NextResponse.json({ notifications });
}

const MarkReadRequestSchema = z.object({ id: z.string().min(1) });

/** PATCH /api/notifications — marca una notificación propia como leída. */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = MarkReadRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !ObjectId.isValid(parsed.data.id)) {
    return NextResponse.json({ error: "ID inválido", code: "INVALID_ID" }, { status: 400 });
  }

  const db = await getDb();
  // El filtro incluye `playerId` para que un jugador nunca pueda marcar como
  // leída la notificación de otro adivinando su ID.
  await db
    .collection("notifications")
    .updateOne({ _id: new ObjectId(parsed.data.id), playerId: session.user.id }, { $set: { read: true } });

  return NextResponse.json({ ok: true });
}
