import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SubmitFeedbackRequestSchema } from "@/lib/schemas/feedback";
import { logger } from "@/lib/logger";

/**
 * POST /api/feedback — un jugador deja un comentario/sugerencia (ver
 * AGENTS.md §2.3 y FeedbackButton.tsx). Requiere sesión (para poder
 * responderle o darle seguimiento por email si hace falta) — guarda
 * `displayName`/`email` como snapshot del momento, no una referencia viva,
 * para que el historial siga siendo legible aunque el jugador cambie su
 * alias después.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = SubmitFeedbackRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Comentario inválido", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const db = await getDb();
  await db.collection("feedback").insertOne({
    playerId: session.user.id,
    displayName: session.user.displayName,
    email: session.user.email ?? "",
    message: parsed.data.message,
    sentiment: parsed.data.sentiment,
    read: false,
    createdAt: new Date(),
    readAt: null,
  });

  logger.info({ playerId: session.user.id }, "feedback.submitted");
  return NextResponse.json({ ok: true });
}
