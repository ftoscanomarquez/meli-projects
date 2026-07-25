import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Guard compartido de las rutas `/api/admin/*` — ver AGENTS.md §9. La
 * verificación de rol se hace siempre en el Route Handler (nunca solo en el
 * cliente/UI), como el resto de las rutas de este proyecto (ver
 * AGENTS.md §3.1 punto 3).
 */
export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 }),
    };
  }
  if (session.user.role !== "admin") {
    return {
      ok: false as const,
      error: NextResponse.json({ error: "No autorizado", code: "FORBIDDEN" }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}
