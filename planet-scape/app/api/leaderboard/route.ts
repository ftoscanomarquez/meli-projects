import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/leaderboard — top 10 global, público. Ver SPECIFICATION-SUMMARY.md §4.
// `force-dynamic`: con `revalidate: 60` este route quedó pre-renderizado en
// build time (leaderboard vacío) y sirvió esa respuesta obsoleta hasta que
// algo disparara la revalidación — ver RETROSPECTIVA.md. Nada de la UI
// actual consume este endpoint (la landing lee Mongo directo, ver
// lib/leaderboard.ts), pero si algo lo llama, debe ver datos reales.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const top10 = await db
    .collection("leaderboard")
    .find({}, { projection: { _id: 0, playerId: 0 } })
    .sort({ bestScore: -1 })
    .limit(10)
    .toArray();

  return NextResponse.json({ entries: top10 });
}
