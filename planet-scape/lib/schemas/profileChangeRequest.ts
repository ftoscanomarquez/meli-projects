import { z } from "zod";

/**
 * Solicitud de cambio de datos sensibles — pedido explícito del usuario
 * (2026-07-22, ver AGENTS.md §6.8): nombre, apellido, fecha de nacimiento y
 * correo principal NO son editables directamente por el jugador (a
 * diferencia de teléfono/correo de recuperación/alias, ver
 * `lib/schemas/player.ts#SelfUpdateProfileRequestSchema`). Si el jugador
 * necesita corregirlos, debe justificar el motivo — el admin revisa
 * manualmente (y puede pedir documentos fuera de la app, por WhatsApp) antes
 * de aplicar el cambio él mismo desde `AdminPlayerSearch.tsx`. Esta ruta
 * NUNCA aplica el cambio automáticamente, solo registra la solicitud.
 */
export const SENSITIVE_FIELDS = ["firstName", "lastName", "birthDate", "email"] as const;
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

export const RequestStatusSchema = z.enum(["pending", "reviewing", "approved", "rejected"]);

export const CreateProfileChangeRequestSchema = z.object({
  fields: z.array(z.enum(SENSITIVE_FIELDS)).min(1),
  requestedValues: z.string().trim().min(1).max(500),
  justification: z.string().trim().min(10).max(1000),
});

export const ProfileChangeRequestSchema = z.object({
  playerId: z.string().min(1),
  requesterDisplayName: z.string().min(1).max(30),
  requesterEmail: z.string().min(1),
  fields: z.array(z.enum(SENSITIVE_FIELDS)).min(1),
  requestedValues: z.string().min(1).max(500),
  justification: z.string().min(1).max(1000),
  status: RequestStatusSchema,
  createdAt: z.date(),
  adminReply: z.string().max(500).nullable(),
  resolvedAt: z.date().nullable(),
  resolvedByAdminId: z.string().nullable(),
});
export type ProfileChangeRequest = z.infer<typeof ProfileChangeRequestSchema>;

export const UpdateProfileChangeRequestSchema = z.object({
  status: RequestStatusSchema,
  adminReply: z.string().trim().max(500).optional(),
});
