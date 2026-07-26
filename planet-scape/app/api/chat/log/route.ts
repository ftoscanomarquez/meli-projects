import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ChatLogRequestSchema } from "@/lib/schemas/chat";
import { evaluateMessage } from "@/lib/chatModeration";
import { logger } from "@/lib/logger";

/**
 * POST /api/chat/log — persiste un mensaje de chat en vivo ya aceptado por
 * el servidor de PartyKit (todos los jugadores de la sala eran mayores de
 * edad, ver party/gameRoom.ts) — pedido explícito del usuario (2026-07-22,
 * ver AGENTS.md §6.6): "todas las conversaciones se deberán guardar en
 * mongo como un histórico... para consulta y análisis... solo el
 * administrador".
 *
 * Quien llama esta ruta NO es un navegador con sesión de Auth.js — es el
 * propio servidor multijugador (Cloudflare Durable Objects, corre vía
 * `wrangler dev` en desarrollo — ver party/worker.ts, migrado de PartyKit
 * el 2026-07-25), un runtime completamente aparte que no comparte cookies
 * con Next.js. Se autentica con un secreto compartido por variable de entorno
 * (`PARTYKIT_SHARED_SECRET`, ya declarado desde la Fase 5 pero sin uso hasta
 * ahora) en vez de una sesión — mismo nivel de confianza que cualquier
 * webhook interno servidor-a-servidor de este proyecto.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-party-secret");
  if (!secret || !process.env.PARTYKIT_SHARED_SECRET || secret !== process.env.PARTYKIT_SHARED_SECRET) {
    return NextResponse.json({ error: "No autorizado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = ChatLogRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", code: "INVALID_BODY" }, { status: 400 });
  }

  // Heurística de moderación (ver lib/chatModeration.ts) — solo marca
  // prioridad de revisión, nunca bloquea el mensaje (ya se reenvió en vivo
  // a los demás jugadores antes de llegar aquí).
  const { flagged, reasons } = evaluateMessage(parsed.data.message);

  const db = await getDb();
  await db.collection("chat_messages").insertOne({
    roomId: parsed.data.roomId,
    playerId: parsed.data.playerId,
    displayName: parsed.data.displayName,
    message: parsed.data.message,
    sentAt: new Date(),
    flagged,
    flagReasons: reasons,
  });

  if (flagged) {
    logger.warn({ roomId: parsed.data.roomId, playerId: parsed.data.playerId, reasons }, "chat.message.flagged");
  }

  return NextResponse.json({ ok: true });
}
