import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

// GET /api/health — ver OBSERVABILIDAD.md §4. no-store: nunca cacheable.
export async function GET() {
  let mongoOk = false;

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    mongoOk = true;
  } catch (error) {
    logger.error({ err: error, route: "/api/health" }, "health.mongo.failed");
  }

  const status = mongoOk ? "ok" : "degraded";

  return NextResponse.json(
    { status, checks: { mongo: mongoOk } },
    { status: mongoOk ? 200 : 503 },
  );
}
