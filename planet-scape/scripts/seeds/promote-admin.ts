import { getDb } from "../../lib/db";

/**
 * Ver README.md y AGENTS.md §7.1. Promueve un jugador ya registrado
 * (inició sesión al menos una vez) a role: "admin".
 * Uso: npm run seed:admin -- --email=tu-email@ejemplo.com
 */
async function main() {
  const emailArg = process.argv.find((arg) => arg.startsWith("--email="));
  const email = emailArg?.split("=")[1];

  if (!email) {
    console.error('Uso: npm run seed:admin -- --email="tu-email@ejemplo.com"');
    process.exit(1);
  }

  const db = await getDb();
  const result = await db.collection("players").updateOne({ email }, { $set: { role: "admin" } });

  if (result.matchedCount === 0) {
    console.error(`promote-admin: no se encontró ningún jugador con email "${email}" — ` +
      "debe iniciar sesión al menos una vez antes de promoverlo.");
    process.exit(1);
  }

  console.log(`promote-admin: "${email}" ahora tiene role: "admin".`);
  process.exit(0);
}

main().catch((err) => {
  console.error("promote-admin failed:", err);
  process.exit(1);
});
