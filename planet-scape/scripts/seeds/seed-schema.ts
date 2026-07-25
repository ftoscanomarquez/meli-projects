import { getDb } from "../../lib/db";

// Ver AGENTS.md §7.1. Solo índices por ahora — el resto de la colección
// `planets`/`ability_templates`/etc. se siembra en seed-abilities.ts/
// seed-planets.ts (Fase de planetas dinámicos, aún no implementada).
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

  console.log(
    "seed-schema: índices creados en players.email/displayName (únicos), leaderboard.bestScore/playerId (único), " +
      "star_transactions.playerId, game_sessions.playerId, donations.stripeSessionId (único), planet_stats.planet (único), " +
      "feedback.read+createdAt, chat_messages.roomId+sentAt/flagged+sentAt, reports.status+createdAt, notifications.playerId+createdAt, " +
      "profile_change_requests.status+createdAt, room_leaderboard.roomId (único)/level.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-schema failed:", err);
  process.exit(1);
});
