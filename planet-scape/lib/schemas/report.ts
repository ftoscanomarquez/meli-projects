import { z } from "zod";

/**
 * Denuncias entre jugadores — pedido explícito del usuario (2026-07-22, ver
 * AGENTS.md §6.6): "debe haber una sección en donde los jugadores puedan
 * denunciar a una persona que está siendo acosada o molestada por otra...
 * nos debe de decir la fecha en que lo molestó y la hora para poderlo
 * buscar en el registro [de chat]". El admin revisa manualmente
 * (`chat_messages` filtrado por `roomId`/alias/fecha) antes de aprobar o
 * rechazar — nunca se amonesta automáticamente solo por recibir una denuncia.
 */
export const ReportStatusSchema = z.enum(["pending", "reviewing", "approved", "rejected"]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const CreateReportRequestSchema = z.object({
  // Alias del jugador denunciado, tal cual lo escribió quien denuncia — se
  // intenta resolver contra `players.displayName` en el servidor (ver
  // app/api/reports/route.ts), pero se guarda igual aunque no se encuentre
  // (el admin puede investigar manualmente con el roomId/fecha).
  reportedAlias: z.string().trim().min(1).max(30),
  // Fecha+hora del incidente, capturadas por separado en el formulario y
  // combinadas en un solo ISO antes de enviarse — permite al admin buscar
  // directo en `chat_messages` alrededor de ese momento.
  incidentAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "incident_date_invalid")
    .refine((v) => new Date(v) <= new Date(), "incident_date_future"),
  // Código de la sala si el jugador lo recuerda — opcional, ayuda a acotar
  // la búsqueda pero no es obligatorio (no todos lo recuerdan de memoria).
  roomId: z.string().trim().max(20).optional(),
  description: z.string().trim().min(10).max(1000),
});

export const ReportSchema = z.object({
  reporterId: z.string().min(1),
  reporterDisplayName: z.string().min(1).max(30),
  reportedAlias: z.string().min(1).max(30),
  // Puede ser null si el alias no se encontró en `players` al momento de
  // denunciar (ej. typo, o el jugador ya cambió de alias) — el admin lo
  // resuelve manualmente en ese caso.
  reportedPlayerId: z.string().nullable(),
  incidentAt: z.date(),
  roomId: z.string().max(20).nullable(),
  description: z.string().min(1).max(1000),
  status: ReportStatusSchema,
  createdAt: z.date(),
  // Mensaje del admin al denunciante (ej. "tu solicitud será atendida") —
  // dispara una notificación in-app, ver lib/schemas/notification.ts.
  adminReply: z.string().max(500).nullable(),
  resolvedAt: z.date().nullable(),
  resolvedByAdminId: z.string().nullable(),
});
export type Report = z.infer<typeof ReportSchema>;

export const UpdateReportRequestSchema = z.object({
  status: ReportStatusSchema,
  adminReply: z.string().trim().max(500).optional(),
});
