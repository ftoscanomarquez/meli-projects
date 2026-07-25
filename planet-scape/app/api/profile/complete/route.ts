import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CompleteProfileRequestSchema } from "@/lib/schemas/player";
import { isAdultBirthDate } from "@/lib/ageUtils";

/**
 * POST /api/profile/complete — registro obligatorio de nombre/apellido/alias
 * (ver AGENTS.md §6.4). El alias se guarda en `players.displayName` (índice
 * único). El chequeo de disponibilidad del cliente (`/api/profile/check-alias`)
 * es solo UX — la fuente de verdad real es el índice único de Mongo: si dos
 * pestañas validan el mismo alias libre y ambas confirman casi al mismo
 * tiempo, el `updateOne` que pierde la carrera recibe un error `E11000`
 * (duplicate key), capturado abajo y devuelto como un error claro en vez de
 * un 500 genérico.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = CompleteProfileRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const { firstName, lastName, alias, birthDate, acceptedTerms, phone, nationality } = parsed.data;
  const db = await getDb();
  const playerId = new ObjectId(session.user.id);
  const birthDateObj = new Date(birthDate);
  // Denormalizado en el propio documento (no recalculado en cada request) —
  // se necesita en la sesión de Auth.js (ver session callback en
  // lib/auth.ts) para gatear el chat en vivo del multijugador sin tener que
  // exponer la fecha de nacimiento exacta al cliente. Ver AGENTS.md §6.5.
  const isAdult = isAdultBirthDate(birthDateObj);
  const profileFields = {
    firstName,
    lastName,
    birthDate: birthDateObj,
    isAdult,
    acceptedTermsAt: acceptedTerms ? new Date() : null,
    profileCompleted: true,
    // Opcionales — ver AGENTS.md §6.7 (recuperación de cuenta). `""` se
    // normaliza a `null` para poder distinguir "nunca lo llenó" de un
    // string vacío al buscarlo después en /api/account/recover.
    phone: phone && phone.length > 0 ? phone : null,
    nationality: nationality && nationality.length > 0 ? nationality : null,
  };

  try {
    const result = await db.collection("players").updateOne(
      { _id: playerId, displayName: { $ne: alias } },
      { $set: { ...profileFields, displayName: alias } },
    );
    // matchedCount === 0 con este filtro puede significar dos cosas: (a) el
    // jugador ya tenía exactamente este alias (nada que hacer, no es error),
    // o (b) el _id no existe (no debería pasar con sesión válida). Se
    // confirma cuál releyendo el documento.
    if (result.matchedCount === 0) {
      const existing = await db.collection("players").findOne({ _id: playerId });
      if (existing?.displayName !== alias) {
        return NextResponse.json({ error: "No se pudo guardar el perfil", code: "UPDATE_FAILED" }, { status: 500 });
      }
      await db.collection("players").updateOne({ _id: playerId }, { $set: profileFields });
    }
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return NextResponse.json(
        { error: "Ese alias ya lo tomó alguien más justo ahora. Intenta con otro.", code: "ALIAS_TAKEN" },
        { status: 409 },
      );
    }
    throw err;
  }

  logger.info({ playerId: session.user.id, alias, isAdult }, "profile.completed");
  return NextResponse.json({ ok: true, displayName: alias, firstName, lastName, isAdult });
}
