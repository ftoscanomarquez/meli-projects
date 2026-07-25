import Stripe from "stripe";

/** Singleton del cliente de Stripe — ver AGENTS.md §10 (Fase 7). */
const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY no está definida — ver .env.example");
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2026-06-24.dahlia",
});
