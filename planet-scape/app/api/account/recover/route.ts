import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { RecoverAccountRequestSchema } from "@/lib/schemas/accountRecovery";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";

/**
 * POST /api/account/recover — pedido explícito del usuario (2026-07-22, ver
 * AGENTS.md §6.7). Sin sesión a propósito (quien la usa, por definición, no
 * puede iniciar sesión — no recuerda su correo). Busca por alias +
 * fecha de nacimiento (día/mes/año exactos); si coincide y el jugador
 * registró un teléfono, manda su correo por WhatsApp (ver lib/whatsapp.ts).
 * Si no hay teléfono registrado, se informa que la cuenta es irrecuperable
 * — pedido literal del usuario, no un genérico "algo salió mal".
 *
 * Nota de seguridad: esta ruta SÍ distingue "alias no encontrado" de "sin
 * teléfono registrado" en su respuesta (a pedido explícito del usuario) —
 * una decisión consciente de UX sobre seguridad estricta, aceptable para el
 * tamaño y el público de este juego familiar (ver mismo criterio que las
 * "cotas de sanidad, no anti-cheat real" de AGENTS.md §7.2).
 */
export async function POST(request: Request) {
  const parsed = RecoverAccountRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", code: "INVALID_BODY" }, { status: 400 });
  }

  const { alias, birthDate } = parsed.data;
  const target = new Date(birthDate);

  const db = await getDb();
  const player = await db.collection("players").findOne({ displayName: alias });

  // Compara día/mes/año en vez de igualdad exacta de `Date` — el valor
  // guardado viene de un <input type="date"> (medianoche UTC), pero para
  // evitar cualquier desfase de zona horaria se comparan los componentes,
  // no el timestamp completo.
  const matches =
    player?.birthDate instanceof Date &&
    player.birthDate.getUTCFullYear() === target.getUTCFullYear() &&
    player.birthDate.getUTCMonth() === target.getUTCMonth() &&
    player.birthDate.getUTCDate() === target.getUTCDate();

  if (!player || !matches) {
    return NextResponse.json({ status: "not_found" as const });
  }

  if (!player.phone) {
    logger.info({ playerId: String(player._id) }, "account.recover.no_phone");
    return NextResponse.json({ status: "no_phone" as const });
  }

  const email = player.email ?? "";
  const result = await sendWhatsAppMessage(
    player.phone,
    `Hola${player.firstName ? " " + player.firstName : ""}, tu cuenta de Planet Scape está registrada con el correo: ${email}`,
  );

  logger.info({ playerId: String(player._id), sent: result.sent }, "account.recover.attempted");
  return NextResponse.json({ status: result.sent ? ("sent" as const) : ("send_failed" as const) });
}
