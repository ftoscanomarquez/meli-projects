import { getDb } from "../../lib/db";

// Ver AGENTS.md §7.1. Script PURAMENTE ESTRUCTURAL: solo crea colecciones
// (implícitamente, al crear su primer índice) e índices — nunca inserta
// datos. Debe correr primero, contra cualquier base de datos nueva (local o
// MongoDB Atlas en producción), antes de seed-config.ts/seed-admins.ts.
//
// El catálogo dinámico de planetas/habilidades (`planets`/`ability_templates`)
// sigue fuera de alcance — ver AGENTS.md §15 — por eso no hay índices para
// esas colecciones todavía.
async function main() {
  const db = await getDb();

  await db.collection("players").createIndex({ email: 1 }, { unique: true });
  // Alias del jugador (registro obligatorio, ver AGENTS.md §6.4) — único
  // para poder distinguir jugadores en multijugador cuando eligen el mismo
  // planeta (se muestra encima de su sprite, ver GameEngine.ts).
  await db.collection("players").createIndex({ displayName: 1 }, { unique: true });
  await db.collection("leaderboard").createIndex({ bestScore: -1 });
  await db.collection("leaderboard").createIndex({ playerId: 1 }, { unique: true });
  await db.collection("star_transactions").createIndex({ playerId: 1, createdAt: -1 });
  await db.collection("game_sessions").createIndex({ playerId: 1, endedAt: -1 });
  await db.collection("donations").createIndex({ stripeSessionId: 1 }, { unique: true });
  // Trazabilidad de donantes (ver AGENTS.md §7, agregado 2026-07-25): permite
  // consultar rápido "todas las donaciones de este jugador" sin escanear toda
  // la colección — base para una campaña futura de beneficios a donantes.
  await db.collection("donations").createIndex({ playerId: 1, createdAt: -1 });
  // Campos resumen en `players` (`totalDonatedCents`/`lastActiveAt`) —
  // permiten ordenar/filtrar donantes o "jugadores más activos" directamente
  // desde `players`, sin agregaciones sobre `donations`/`game_sessions`.
  await db.collection("players").createIndex({ totalDonatedCents: -1 });
  await db.collection("players").createIndex({ lastActiveAt: -1 });
  // Contador de popularidad por planeta (❤️ en el carrusel, ver AGENTS.md §2.3).
  await db.collection("planet_stats").createIndex({ planet: 1 }, { unique: true });
  // Comentarios/sugerencias de jugadores (ver AGENTS.md §2.3) — `read` es
  // baja lógica (nunca se borra el documento), este índice hace barato
  // tanto el filtro por defecto (solo no leídos) como el listado completo.
  await db.collection("feedback").createIndex({ read: 1, createdAt: -1 });
  // Chat en vivo / moderación (ver AGENTS.md §6.6) — búsqueda del admin por
  // sala o por mensajes marcados primero.
  await db.collection("chat_messages").createIndex({ roomId: 1, sentAt: -1 });
  await db.collection("chat_messages").createIndex({ flagged: 1, sentAt: -1 });
  // Denuncias entre jugadores — filtro por defecto del panel (pending/reviewing).
  await db.collection("reports").createIndex({ status: 1, createdAt: -1 });
  // Notificaciones in-app — siempre se consultan por dueño, más recientes primero.
  await db.collection("notifications").createIndex({ playerId: 1, createdAt: -1 });
  // Solicitudes de cambio de datos sensibles (ver AGENTS.md §6.8) — filtro
  // por defecto del panel de admin (pending/reviewing).
  await db.collection("profile_change_requests").createIndex({ status: 1, createdAt: -1 });
  // Top 5 de salas/equipos (2026-07-23, ver AGENTS.md §8) — un documento por
  // sala (único), ordenado por nivel récord para el widget de la landing.
  await db.collection("room_leaderboard").createIndex({ roomId: 1 }, { unique: true });
  await db.collection("room_leaderboard").createIndex({ level: -1 });

  // Migración aditiva (no destructiva, mismo patrón que seed-config.ts):
  // rellena los campos resumen de trazabilidad de donantes/actividad (ver
  // AGENTS.md §7, 2026-07-25) SOLO en documentos que no los tengan todavía —
  // nunca pisa un valor ya acumulado por un jugador real. Necesario porque
  // los índices de arriba (totalDonatedCents/lastActiveAt) ordenan mejor
  // cuando el campo existe en todos los documentos, no solo en los nuevos.
  const backfill = await db.collection("players").updateMany(
    { totalDonatedCents: { $exists: false } },
    {
      $set: {
        totalDonatedCents: 0,
        donationCount: 0,
        lastDonationAt: null,
        gamesPlayedCount: 0,
        lastActiveAt: null,
      },
    },
  );
  if (backfill.modifiedCount > 0) {
    console.log(`seed-schema: backfill de campos resumen aplicado a ${backfill.modifiedCount} jugador(es) existentes.`);
  }

  console.log(
    "seed-schema: índices creados en players.email/displayName (únicos)/totalDonatedCents/lastActiveAt, " +
      "leaderboard.bestScore/playerId (único), star_transactions.playerId, game_sessions.playerId, " +
      "donations.stripeSessionId (único)/playerId+createdAt, planet_stats.planet (único), " +
      "feedback.read+createdAt, chat_messages.roomId+sentAt/flagged+sentAt, reports.status+createdAt, notifications.playerId+createdAt, " +
      "profile_change_requests.status+createdAt, room_leaderboard.roomId (único)/level.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-schema failed:", err);
  process.exit(1);
});
