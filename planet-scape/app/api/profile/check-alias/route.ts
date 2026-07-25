import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CheckAliasRequestSchema } from "@/lib/schemas/player";

/**
 * GET /api/profile/check-alias?alias=X — ver AGENTS.md §6.4. Consulta
 * disponibilidad en vivo contra `players.displayName` (índice único, ver
 * scripts/seeds/seed-schema.ts); si está tomado, sugiere una variante
 * disponible (mismo alias + 2-3 dígitos al azar) para que el jugador la
 * edite si no le gusta.
 */
async function findAvailableSuggestion(
  db: Awaited<ReturnType<typeof getDb>>,
  base: string,
  excludeId: ObjectId,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = randomInt(10, 999);
    const candidate = `${base}${suffix}`.slice(0, 20);
    const exists = await db.collection("players").findOne({ displayName: candidate, _id: { $ne: excludeId } });
    if (!exists) return candidate;
  }
  return `${base}${Date.now() % 100000}`.slice(0, 20);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = CheckAliasRequestSchema.safeParse({ alias: searchParams.get("alias") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Alias inválido", code: "INVALID_ALIAS" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const ownId = new ObjectId(session.user.id);
  const taken = await db.collection("players").findOne({ displayName: parsed.data.alias, _id: { $ne: ownId } });

  if (!taken) {
    return NextResponse.json({ available: true });
  }

  const suggestion = await findAvailableSuggestion(db, parsed.data.alias, ownId);
  return NextResponse.json({ available: false, suggestion });
}
