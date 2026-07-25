import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { AdminUpdateProfileRequestSchema } from "@/lib/schemas/admin";
import { isAdultBirthDate } from "@/lib/ageUtils";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/admin/players/:id/profile — el admin corrige nombre/apellido/
 * alias/fecha de nacimiento/teléfono de un jugador (2026-07-22, pedido
 * explícito del usuario) — estos son justo los campos que el propio
 * jugador NO puede tocar desde su autoservicio de perfil (ver AGENTS.md
 * §6.8, `app/api/profile/route.ts`), salvo el teléfono (que el jugador sí
 * puede editar él mismo; el admin puede corregirlo igual, ej. a pedido del
 * jugador por otro medio). El alias se guarda en `players.displayName`
 * (índice único, ver scripts/seeds/seed-schema.ts) — si otro jugador ya lo
 * tiene, Mongo rechaza el `updateOne` con `E11000` y se devuelve un error
 * claro en vez de un 500 genérico, igual que en el registro obligatorio del
 * propio jugador (ver app/api/profile/complete/route.ts).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID de jugador inválido", code: "INVALID_PLAYER_ID" }, { status: 400 });
  }

  const parsed = AdminUpdateProfileRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const { firstName, lastName, alias, birthDate, phone, unlockedPlanets } = parsed.data;
  const playerId = new ObjectId(id);
  const db = await getDb();

  // `birthDate`/`phone`/`unlockedPlanets` son opcionales en el body — solo
  // se tocan si el admin de verdad los mandó, para no pisar un valor
  // existente con "" o [].
  const fieldsToSet: Record<string, unknown> = { firstName, lastName, displayName: alias };
  if (birthDate !== undefined) {
    const birthDateObj = new Date(birthDate);
    fieldsToSet.birthDate = birthDateObj;
    // Recalculado igual que en el registro obligatorio (ver
    // app/api/profile/complete/route.ts) — nunca queda desincronizado de
    // la fecha real tras una corrección del admin.
    fieldsToSet.isAdult = isAdultBirthDate(birthDateObj);
  }
  if (phone !== undefined) fieldsToSet.phone = phone || null;
  // Checklist de planetas premium — pedido explícito del usuario
  // (2026-07-24): "un checkbox de los planetas desbloqueados... para en
  // caso de ser necesario volverlo a deshabilitar". Valor ABSOLUTO (no un
  // delta) — reemplaza la lista completa con la que mande el admin.
  if (unlockedPlanets !== undefined) fieldsToSet.unlockedPlanets = unlockedPlanets;

  try {
    const result = await db.collection("players").updateOne({ _id: playerId }, { $set: fieldsToSet });
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Jugador no encontrado", code: "PLAYER_NOT_FOUND" }, { status: 404 });
    }
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return NextResponse.json(
        { error: "Ese alias ya lo tiene otro jugador.", code: "ALIAS_TAKEN" },
        { status: 409 },
      );
    }
    throw err;
  }

  logger.info({ adminId: guard.session.user.id, playerId: id, alias }, "admin.player.profile_updated");
  return NextResponse.json({ displayName: alias, firstName, lastName, birthDate, phone, unlockedPlanets });
}
