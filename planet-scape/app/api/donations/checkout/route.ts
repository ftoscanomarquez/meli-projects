import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { CreateCheckoutRequestSchema } from "@/lib/schemas/donation";
import { getGameConfig } from "@/lib/gameConfig";
import { getRequestOrigin } from "@/lib/requestOrigin";
import { logger } from "@/lib/logger";

// POST /api/donations/checkout — ver AGENTS.md §10. Crea la Checkout
// Session; el acreditado de estrellas ocurre en el webhook (fuente de
// verdad del pago), nunca aquí — este endpoint solo inicia el cobro.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateCheckoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Monto inválido", code: "INVALID_AMOUNT" },
      { status: 400 },
    );
  }

  const { donation } = await getGameConfig();
  if (parsed.data.amountCents < donation.minAmountCents || parsed.data.amountCents > donation.maxAmountCents) {
    return NextResponse.json({ error: "Monto fuera de rango", code: "INVALID_AMOUNT" }, { status: 400 });
  }

  const origin = getRequestOrigin(request);
  const locale = new URL(request.headers.get("referer") ?? origin).pathname.split("/")[1] || "es";

  const db = await getDb();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: parsed.data.amountCents,
          product_data: {
            name: "Aportación voluntaria — Planet Scape",
            description: "Gracias por apoyar a Meli a seguir estudiando y creando 💛",
          },
        },
      },
    ],
    metadata: { playerId: session.user.id },
    success_url: `${origin}/${locale}?donation=success`,
    cancel_url: `${origin}/${locale}?donation=cancelled`,
  });

  await db.collection("donations").insertOne({
    playerId: session.user.id,
    amountCents: parsed.data.amountCents,
    currency: "mxn",
    stripeSessionId: checkoutSession.id,
    status: "pending",
    createdAt: new Date(),
  });

  logger.info({ playerId: session.user.id, amountCents: parsed.data.amountCents }, "donation.checkout.created");

  return NextResponse.json({ url: checkoutSession.url });
}
