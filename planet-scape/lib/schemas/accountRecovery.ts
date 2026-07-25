import { z } from "zod";

/**
 * Recuperación de cuenta por alias + fecha de nacimiento — pedido explícito
 * del usuario (2026-07-22, ver AGENTS.md §6.7): "en caso de que no
 * recuerden su correo, y solo recuerden su alias, deberá haber un tema de
 * recuperación de cuenta... le preguntará su alias y fecha de nacimiento".
 */
export const RecoverAccountRequestSchema = z.object({
  alias: z.string().trim().min(1).max(20),
  birthDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "birth_date_invalid"),
});
