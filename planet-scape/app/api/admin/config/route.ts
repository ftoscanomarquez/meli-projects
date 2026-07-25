import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { getGameConfig } from "@/lib/gameConfig";
import { GameConfigSchema } from "@/lib/schemas/gameConfig";
import { logger } from "@/lib/logger";

// GET/PUT /api/admin/config — ver AGENTS.md §9 (Fase 8). Documento único
// `game_config`; cada partida/lobby nueva lo relee sin caché (ver
// lib/gameConfig.ts), así que un PUT aquí se refleja sin redeploy.
export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const config = await getGameConfig();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const body = await request.json().catch(() => null);
  const parsed = GameConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Configuración inválida", code: "INVALID_CONFIG" },
      { status: 400 },
    );
  }

  const db = await getDb();
  await db.collection("game_config").updateOne({}, { $set: parsed.data }, { upsert: true });

  logger.info({ adminId: guard.session.user.id }, "admin.config.updated");

  return NextResponse.json(parsed.data);
}
