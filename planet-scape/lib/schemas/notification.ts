import { z } from "zod";

/**
 * Notificaciones in-app — pedido explícito del usuario (2026-07-22, ver
 * AGENTS.md §6.6): el admin puede "mandar mensajes a ciertos usuarios en
 * donde avise que su solicitud será atendida", y un jugador amonestado debe
 * enterarse de su strike. Sin proveedor de email/push real todavía (Mailpit
 * es solo para Magic Link, ver AGENTS.md §6.1) — se guarda en Mongo y se
 * muestra en un badge dentro de la propia app (NotificationBell.tsx),
 * consultado por el jugador dueño de la sesión.
 */
export const NotificationSchema = z.object({
  playerId: z.string().min(1),
  message: z.string().min(1).max(500),
  // Distingue el tono en la UI (ej. rojo para un strike, neutro para una
  // respuesta de admin a una denuncia) sin tener que parsear el texto.
  kind: z.enum(["admin_reply", "strike_warning", "account_banned"]),
  read: z.boolean(),
  createdAt: z.date(),
});
export type Notification = z.infer<typeof NotificationSchema>;
