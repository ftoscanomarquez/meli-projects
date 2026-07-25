import { z } from "zod";

/**
 * Comentarios y sugerencias de los jugadores — pedido explícito del usuario
 * (2026-07-22): "agrega una sección de comentarios y sugerencias para que
 * los jugadores puedan dejar sus opiniones buenas y malas". Ver
 * app/api/feedback/route.ts (jugador) y app/api/admin/feedback/*
 * (administración) y AGENTS.md §2.3.
 *
 * `read` cumple doble función: "ya lo leyó el admin" Y "baja lógica" — el
 * usuario pidió explícitamente que marcar como leído los oculte de la
 * búsqueda normal SIN borrarlos de Mongo ("que queden ocultos... pero no
 * borrados, es decir un borrado lógico").
 */
export const FeedbackSentiment = z.enum(["positive", "negative", "neutral"]);

export const SubmitFeedbackRequestSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  sentiment: FeedbackSentiment.default("neutral"),
});

export const FeedbackEntrySchema = z.object({
  id: z.string(),
  playerId: z.string(),
  displayName: z.string(),
  email: z.string(),
  message: z.string(),
  sentiment: FeedbackSentiment,
  read: z.boolean(),
  createdAt: z.date(),
  readAt: z.date().nullable(),
});

export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;
