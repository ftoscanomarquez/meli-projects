import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/client-log — trazabilidad del cliente hacia el logger del
 * servidor (Pino, ver OBSERVABILIDAD.md). Agregado 2026-07-22 para poder
 * diagnosticar un bug real reportado en vivo (el motor de juego "se
 * reiniciaba" a nivel 0 sin ningún mensaje de derrota, ver RETROSPECTIVA.md)
 * — sin esto, un error/remount en el celular de otro jugador es invisible
 * para nosotros. Público (sin sesión requerida): también debe capturar
 * errores de ANTES de iniciar sesión. Rate limit en proxy.ts.
 */
const ClientLogSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  event: z.string().min(1).max(120),
  data: z.record(z.string(), z.unknown()).optional(),
  url: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const parsed = ClientLogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", code: "INVALID_BODY" }, { status: 400 });
  }
  const { level, event, data, url } = parsed.data;

  const session = await auth().catch(() => null);
  logger[level](
    { source: "client", event, data, url, playerId: session?.user?.id },
    `client.${event}`,
  );

  return NextResponse.json({ ok: true });
}
