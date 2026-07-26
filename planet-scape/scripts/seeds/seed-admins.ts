import { getDb } from "../../lib/db";

/**
 * Ver AGENTS.md §7.1. Siembra las cuentas admin iniciales del proyecto —
 * pedido explícito del usuario (2026-07-25): Francisco y Melissa deben
 * existir como `role: "admin"` desde el arranque de un ambiente nuevo (ej.
 * producción en Atlas), sin depender de `npm run seed:admin` (que requiere
 * que el jugador ya haya iniciado sesión al menos una vez — ver
 * promote-admin.ts).
 *
 * El documento se crea con la MISMA forma que Auth.js espera de un usuario
 * ya existente (ver lib/auth.ts — el adapter de Mongo mapea su colección
 * "Users" directamente a `players`, identificando por `email`): al hacer
 * login por primera vez con Magic Link, el adapter los encuentra por email
 * y NO dispara el evento `createUser` (ese solo corre cuando el documento no
 * existe todavía) — por eso este script ya deja `profileCompleted: true`,
 * `isAdult: true` y el resto de campos de negocio completos, para que nunca
 * les aparezca el registro obligatorio de perfil (ProfileOnboarding.tsx).
 *
 * Idempotente y NO destructivo: si la cuenta ya existe (ej. porque la
 * persona ya jugó antes de correr este seed), solo se asegura `role:
 * "admin"` — nunca pisa `stars`/`unlockedPlanets`/`displayName` ya en uso.
 */
const INITIAL_ADMINS = [
  {
    email: "francisco.alberto.tm@gmail.com",
    firstName: "Francisco",
    lastName: "Toscano",
    displayName: "francisco_admin",
  },
  {
    email: "melissa.amaia.ta@gmail.com",
    firstName: "Melissa",
    lastName: "Toscano",
    displayName: "melissa_admin",
  },
];

async function main() {
  const db = await getDb();
  const players = db.collection("players");

  for (const admin of INITIAL_ADMINS) {
    const existing = await players.findOne({ email: admin.email });

    if (existing) {
      if (existing.role !== "admin") {
        await players.updateOne({ _id: existing._id }, { $set: { role: "admin" } });
        console.log(`seed-admins: "${admin.email}" ya existía — promovido a role: "admin".`);
      } else {
        console.log(`seed-admins: "${admin.email}" ya existía y ya era admin — sin cambios.`);
      }
      continue;
    }

    const now = new Date();
    await players.insertOne({
      email: admin.email,
      emailVerified: null, // Auth.js lo marca al primer login por Magic Link
      displayName: admin.displayName,
      firstName: admin.firstName,
      lastName: admin.lastName,
      profileCompleted: true, // nunca les debe salir el onboarding obligatorio
      stars: 0,
      role: "admin",
      unlockedPlanets: [],
      // Fecha de nacimiento placeholder (mayor de edad) — ver AGENTS.md §6.5:
      // isAdult se recalcula server-side si el admin la corrige desde su
      // propio perfil (MyProfileModal.tsx) o desde /admin.
      birthDate: new Date("1990-01-01"),
      isAdult: true,
      acceptedTerms: true,
      acceptedTermsAt: now,
      banned: false,
      strikes: 0,
      phone: null,
      nationality: null,
      recoveryEmail: null,
      // Campos resumen (ver AGENTS.md §7, agregado 2026-07-25) — trazabilidad
      // de donantes y jugadores más activos. Se incrementan solos desde el
      // webhook de Stripe (app/api/webhooks/stripe/route.ts) y desde el fin
      // de partida (app/api/sessions/complete/route.ts).
      totalDonatedCents: 0,
      donationCount: 0,
      lastDonationAt: null,
      gamesPlayedCount: 0,
      lastActiveAt: null,
      createdAt: now,
    });
    console.log(`seed-admins: "${admin.email}" creado como role: "admin".`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("seed-admins failed:", err);
  process.exit(1);
});
