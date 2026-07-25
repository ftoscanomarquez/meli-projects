import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SelfUpdateProfileRequestSchema } from "@/lib/schemas/player";
import { logger } from "@/lib/logger";

/**
 * GET /api/profile — datos del propio perfil, incluidos los campos
 * bloqueados (nombre/apellido/fecha de nacimiento/correo principal) para
 * que el jugador pueda VERLOS aunque no pueda editarlos aquí — ver
 * AGENTS.md §6.8 y `components/profile/MyProfileModal.tsx`. La fecha de
 * nacimiento sí se expone al DUEÑO de la cuenta (a diferencia de
 * `session.user.isAdult`, que es lo único que ven los demás — ver §6.5):
 * verla en su propio perfil no es el mismo riesgo de privacidad que
 * exponerla a otros jugadores.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const db = await getDb();
  const player = await db.collection("players").findOne({ _id: new ObjectId(session.user.id) });
  if (!player) {
    return NextResponse.json({ error: "Jugador no encontrado", code: "PLAYER_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    firstName: player.firstName ?? "",
    lastName: player.lastName ?? "",
    email: player.email ?? "",
    alias: player.displayName ?? "",
    birthDate: player.birthDate instanceof Date ? player.birthDate.toISOString().slice(0, 10) : null,
    phone: player.phone ?? "",
    recoveryEmail: player.recoveryEmail ?? "",
    nationality: player.nationality ?? "",
  });
}

/**
 * PATCH /api/profile — autoservicio del jugador (ver AGENTS.md §6.8): SOLO
 * acepta alias/teléfono/correo de recuperación. `SelfUpdateProfileRequestSchema`
 * ni siquiera declara nombre/apellido/fecha de nacimiento/correo principal
 * como campos válidos, y el `$set` de abajo solo escribe estos 3 — no hay
 * forma de colar un cambio a un campo bloqueado por esta ruta, aunque el
 * cliente lo mande en el body.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = SelfUpdateProfileRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const { alias, phone, recoveryEmail } = parsed.data;
  const playerId = new ObjectId(session.user.id);
  const db = await getDb();

  try {
    const result = await db.collection("players").updateOne(
      { _id: playerId },
      {
        $set: {
          displayName: alias,
          phone: phone || null,
          recoveryEmail: recoveryEmail || null,
        },
      },
    );
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

  logger.info({ playerId: session.user.id }, "profile.self_updated");
  return NextResponse.json({ alias, phone, recoveryEmail });
}
