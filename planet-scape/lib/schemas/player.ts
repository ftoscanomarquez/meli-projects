import { z } from "zod";
import { calculateAge } from "@/lib/ageUtils";

/**
 * Registro obligatorio de perfil (alias/nombre/apellido) — pedido explícito
 * del usuario (2026-07-22): "cuando se inicia por primera vez debe
 * presentarte también una opción de poder registrar tu nombre y apellido y
 * también poner tu alias". Ver AGENTS.md §6.4, `ProfileOnboarding.tsx`,
 * `app/api/profile/*`.
 *
 * El alias se guarda en `players.displayName` (ya existía desde la Fase 1,
 * usado en leaderboard/roster/admin) — no se agrega un campo nuevo, solo se
 * le exige ser único y elegido por el jugador en vez de auto-generado.
 */
export const AliasSchema = z
  .string()
  .trim()
  .min(3, "alias_too_short")
  .max(20, "alias_too_long")
  .regex(/^[a-zA-Z0-9_.-]+$/, "alias_invalid_chars");

// Edad + Términos y Condiciones — pedido explícito del usuario (2026-07-22):
// "entre los datos de captura también tendremos que agregar la edad...
// tendrán que aceptar los términos y condiciones para poder jugar". Se pide
// la FECHA de nacimiento (no solo un número de edad) — mismo patrón que
// Roblox y la mayoría de plataformas: más honesto que un campo "edad" que
// se puede subir de uno en uno año tras año sin que nadie lo note.
const BirthDateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "birth_date_invalid")
  .refine((v) => new Date(v) <= new Date(), "birth_date_future")
  .refine((v) => calculateAge(new Date(v)) <= 120, "birth_date_too_old");

// Teléfono y nacionalidad — pedido explícito del usuario (2026-07-22, ver
// AGENTS.md §6.7): campos OPCIONALES usados únicamente para la recuperación
// de cuenta (alias + fecha de nacimiento -> se manda el correo registrado
// por WhatsApp al teléfono). Sin teléfono registrado, la recuperación
// simplemente informa que la cuenta no se puede recuperar (ver
// app/api/account/recover/route.ts) — no bloquea el registro ni el juego.
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\s-]{7,20}$/, "phone_invalid");

export const CompleteProfileRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  alias: AliasSchema,
  birthDate: BirthDateSchema,
  // El checkbox de aceptación exige `true` literal — no basta con omitir el
  // campo ni mandar `false`, ver ProfileOnboarding.tsx.
  acceptedTerms: z.literal(true, { message: "terms_not_accepted" }),
  phone: z.union([PhoneSchema, z.literal("")]).optional(),
  nationality: z.string().trim().max(60).optional(),
});

export const CheckAliasRequestSchema = z.object({
  alias: AliasSchema,
});

// Correo de recuperación — pedido explícito del usuario (2026-07-22): dato
// NUEVO y persistente, editable por el propio jugador desde su perfil,
// usado (a futuro) para recuperar el acceso a la cuenta. Distinto del
// correo principal (nunca editable por el jugador, ver
// SelfUpdateProfileRequestSchema abajo).
export const RecoveryEmailSchema = z.union([z.string().trim().email("recovery_email_invalid"), z.literal("")]);

/**
 * Autoservicio de perfil (2026-07-22, ver AGENTS.md §6.8) — el jugador
 * SOLO puede editar teléfono, correo de recuperación y alias (validado por
 * disponibilidad, mismo patrón que el registro obligatorio). Nombre,
 * apellido, fecha de nacimiento y correo principal son intencionalmente
 * intocables aquí — cualquier cambio a esos requiere una solicitud humana
 * revisada por un admin (ver ProfileChangeRequestSchema).
 */
export const SelfUpdateProfileRequestSchema = z.object({
  alias: AliasSchema,
  phone: z.union([PhoneSchema, z.literal("")]),
  recoveryEmail: RecoveryEmailSchema,
});
