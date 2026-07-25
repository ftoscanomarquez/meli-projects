import { z } from "zod";

/** Ver SPECIFICATION-SUMMARY.md §3 y AGENTS.md §7. */
export const StarTransactionSchema = z.object({
  _id: z.string().optional(),
  playerId: z.string(),
  amount: z.number().int(), // positivo = ganado, negativo = gastado en desbloqueo
  reason: z.enum(["gameplay", "donation_reward", "admin_adjustment", "planet_unlock"]),
  relatedSessionId: z.string().optional(),
  // Solo presente cuando `reason === "admin_adjustment"` — quién hizo el
  // ajuste manual, ver AGENTS.md §9 y app/api/admin/players/[id]/stars/route.ts.
  adminId: z.string().optional(),
  createdAt: z.date(),
});

export type StarTransaction = z.infer<typeof StarTransactionSchema>;
