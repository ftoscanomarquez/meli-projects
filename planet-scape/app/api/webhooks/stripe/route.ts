import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { stripe } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { getGameConfig } from "@/lib/gameConfig";
import { logger } from "@/lib/logger";

// POST /api/webhooks/stripe — ver AGENTS.md §10. Firma Stripe (no sesión de
// usuario). Idempotente por `stripeSessionId`: un webhook puede reintentarse,
// nunca debe acreditar estrellas dos veces por el mismo pago.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    logger.error({ route: "webhooks.stripe" }, "webhook.missing_signature_or_secret");
    return NextResponse.json({ error: "Firma faltante", code: "MISSING_SIGNATURE" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    logger.error({ err, route: "webhooks.stripe" }, "webhook.signature_verification_failed");
    return NextResponse.json({ error: "Firma inválida", code: "INVALID_SIGNATURE" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const checkoutSession = event.data.object;
  const playerId = checkoutSession.metadata?.playerId;
  if (!playerId) {
    logger.error({ sessionId: checkoutSession.id }, "webhook.missing_player_id");
    return NextResponse.json({ received: true });
  }

  const db = await getDb();
  const donations = db.collection("donations");

  // Idempotencia: si ya se procesó este pago, no se vuelve a acreditar.
  const existing = await donations.findOne({ stripeSessionId: checkoutSession.id });
  if (existing?.status === "completed") {
    logger.info({ sessionId: checkoutSession.id }, "webhook.already_processed");
    return NextResponse.json({ received: true });
  }

  const updateResult = await donations.updateOne(
    { stripeSessionId: checkoutSession.id, status: { $ne: "completed" } },
    { $set: { status: "completed" } },
  );

  // Si otro webhook concurrente ya lo marcó completado entre el findOne y
  // este updateOne, `modifiedCount` es 0 y no se acredita dos veces.
  if (updateResult.modifiedCount === 0) {
    logger.info({ sessionId: checkoutSession.id }, "webhook.race_already_processed");
    return NextResponse.json({ received: true });
  }

  const { donation } = await getGameConfig();
  const playerObjectId = new ObjectId(playerId);
  const now = new Date();
  await db.collection("star_transactions").insertOne({
    playerId: playerObjectId,
    amount: donation.rewardStars,
    reason: "donation_reward",
    createdAt: now,
  });
  // Campos resumen en `players` (ver AGENTS.md §7) — permiten identificar
  // donantes y ordenarlos/filtrarlos (ej. para una campaña futura con
  // beneficios a quien ya donó) sin sumar toda la colección `donations` cada
  // vez. `amount_total` de Stripe es la fuente de verdad del monto real
  // cobrado (en centavos, misma unidad que `amountCents` en `donations`),
  // no el `amountCents` que el cliente pidió al crear el checkout.
  await db.collection("players").updateOne(
    { _id: playerObjectId },
    {
      $inc: {
        stars: donation.rewardStars,
        totalDonatedCents: checkoutSession.amount_total ?? 0,
        donationCount: 1,
      },
      $set: { lastDonationAt: now },
    },
  );

  logger.info(
    { playerId, sessionId: checkoutSession.id, amountTotal: checkoutSession.amount_total },
    "webhook.donation_completed",
  );

  return NextResponse.json({ received: true });
}
