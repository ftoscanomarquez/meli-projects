import { getDb } from "@/lib/db";

/**
 * Popularidad de planetas (contador ❤️ en el carrusel) — ver AGENTS.md §2.3
 * y app/api/planets/played/route.ts. Lectura directa a Mongo desde Server
 * Component (ver AGENTS.md §12 regla 6).
 */
export async function getPlanetPlayCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  const docs = await db.collection("planet_stats").find({}).toArray();
  const counts: Record<string, number> = {};
  for (const doc of docs) {
    counts[String(doc.planet)] = Number(doc.playCount ?? 0);
  }
  return counts;
}
