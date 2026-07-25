import { z } from "zod";

/**
 * Historial de chat en vivo — pedido explícito del usuario (2026-07-22, ver
 * AGENTS.md §6.6): "todas las conversaciones se deberán guardar en mongo
 * como un histórico". `roomId` es la misma clave de 6 caracteres que los
 * jugadores usan para unirse a la sala (ver party/gameRoom.ts, `room.id`) —
 * doble uso como "nombre de partida" y clave de búsqueda para el admin.
 *
 * Se inserta desde `app/api/chat/log/route.ts`, llamado por el propio
 * servidor de PartyKit (no por el navegador — no hay sesión de usuario ahí,
 * ver ChatLogRequestSchema abajo y el guard de secreto compartido en la ruta).
 */
export const ChatMessageSchema = z.object({
  roomId: z.string().min(1).max(20),
  playerId: z.string().min(1),
  displayName: z.string().min(1).max(30),
  message: z.string().min(1).max(300),
  sentAt: z.date(),
  // Ver lib/chatModeration.ts — marca de prioridad de revisión, nunca de
  // censura/bloqueo automático.
  flagged: z.boolean(),
  flagReasons: z.array(z.string()),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** Payload que manda party/gameRoom.ts a /api/chat/log (servicio-a-servicio). */
export const ChatLogRequestSchema = z.object({
  roomId: z.string().min(1).max(20),
  playerId: z.string().min(1),
  displayName: z.string().min(1).max(30),
  message: z.string().trim().min(1).max(300),
});
