import { z } from "zod";

/** Ver AGENTS.md §10 y SPECIFICATION-SUMMARY.md §3 — SIEMPRE en centavos. */
export const DonationSchema = z.object({
  _id: z.string().optional(),
  playerId: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.literal("mxn"),
  stripeSessionId: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  createdAt: z.date(),
});

export type Donation = z.infer<typeof DonationSchema>;

// Límites reales (min/step/max/estrellas) viven en `game_config.donation`,
// editables por el admin sin redeploy — ver AGENTS.md §9 y lib/gameConfig.ts.
// Este schema solo valida la forma del request; el rango se valida en la
// ruta contra la config actual de Mongo.
export const CreateCheckoutRequestSchema = z.object({
  amountCents: z.number().int().positive(),
});
