import { z } from "zod";
import { PhoneSchema } from "./player";
import { PREMIUM_PLANET_KEYS } from "@/engine/characterSvg";

// Planetas premium que el admin puede des/bloquear manualmente — ver
// AGENTS.md §9, pedido explícito del usuario (2026-07-24): "que tambien
// aparezca un checkbox de los planetas desbloqueados... para en caso de
// ser necesario volverlo a deshabilitar". Los 4 planetas starter nunca
// aparecen aquí — nunca estuvieron "bloqueados" para empezar.
export const PremiumPlanetKeySchema = z.enum(PREMIUM_PLANET_KEYS as [string, ...string[]]);

/** Ver AGENTS.md §9 (Fase 8) y SPECIFICATION-SUMMARY.md §3. */
export const AdjustStarsRequestSchema = z.object({
  // Positivo o negativo — se aplica como delta sobre `players.stars`,
  // nunca como valor absoluto (ver app/api/admin/players/[id]/stars/route.ts).
  amount: z.number().int().refine((n) => n !== 0, "El ajuste no puede ser 0"),
});

export const PlayerSearchResultSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  stars: z.number().int(),
  role: z.enum(["player", "admin"]),
  // Mostrados como información de perfil en el modal de edición del admin
  // (2026-07-22, ver AGENTS.md §6.8) — `birthDate` en formato `YYYY-MM-DD`
  // para prellenar un `<input type="date">`, `null` si el jugador no lo
  // tiene registrado (cuentas viejas).
  birthDate: z.string().nullable(),
  phone: z.string().nullable(),
  // Planetas premium ya comprados/desbloqueados — ver AGENTS.md §5.2/§9.
  // Mostrado como checklist editable en el modal de edición del admin
  // (2026-07-24, pedido explícito del usuario).
  unlockedPlanets: z.array(z.string()),
});

export type PlayerSearchResult = z.infer<typeof PlayerSearchResultSchema>;

// PATCH /api/admin/players/:id/profile — el admin puede corregir el
// nombre/apellido/alias/fecha de nacimiento/teléfono de un jugador
// (2026-07-22, pedido explícito del usuario: "que permita editar su fecha
// de cumpleaños o su número de celular"). Reutiliza las mismas reglas del
// alias/teléfono que el registro obligatorio del propio jugador (ver
// lib/schemas/player.ts). `birthDate`/`phone` son opcionales para no
// obligar al admin a re-enviar todo si solo quiere corregir nombre/alias.
export const AdminUpdateProfileRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  alias: z
    .string()
    .trim()
    .min(3, "alias_too_short")
    .max(20, "alias_too_long")
    .regex(/^[a-zA-Z0-9_.-]+$/, "alias_invalid_chars"),
  birthDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "birth_date_invalid")
    .optional(),
  phone: z.union([PhoneSchema, z.literal("")]).optional(),
  // Checklist de planetas premium — el admin puede quitar uno (deshabilitar
  // el acceso ya comprado) o agregarlo (otorgarlo sin cobrar estrellas) sin
  // tocar `players.stars`. Opcional: si no se manda, no se toca el campo.
  unlockedPlanets: z.array(PremiumPlanetKeySchema).optional(),
});
