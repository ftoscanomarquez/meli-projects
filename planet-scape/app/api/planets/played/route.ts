import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";

/**
 * POST /api/planets/played — contador persistente de popularidad, puramente
 * informativo (pedido explícito del usuario, 2026-07-22): "que se lleve un
 * registro de qué planeta es el que han elegido jugar más... si dos
 * personas eligen a la Tierra, que salga un corazoncito con un número 2".
 * Se dispara una vez por partida REAL iniciada (ver GameCanvas.tsx, cuando
 * el motor monta de verdad), no solo al seleccionarlo en el carrusel — así
 * el número refleja partidas jugadas, no clics de exploración. Sin
 * autenticación a propósito: cuenta partidas, no jugadores, y no expone
 * nada sensible.
 */
const PlayedRequestSchema = z.object({
  planet: z.enum(["mercury", "venus", "earth", "mars", "jupiter", "saturn", "neptune"]),
});

export async function POST(request: Request) {
  const parsed = PlayedRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", code: "INVALID_BODY" }, { status: 400 });
  }

  const db = await getDb();
  // `planet` como campo normal + índice único (no como `_id`, que Mongo
  // tipa como ObjectId por defecto — ver scripts/seeds/seed-schema.ts).
  await db
    .collection("planet_stats")
    .updateOne({ planet: parsed.data.planet }, { $inc: { playCount: 1 } }, { upsert: true });

  return NextResponse.json({ ok: true });
}
