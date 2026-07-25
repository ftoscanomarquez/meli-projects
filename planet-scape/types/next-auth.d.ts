import type { DefaultSession } from "next-auth";

// Augmentación de tipos — ver AGENTS.md §12 regla 3 (prohibido `any`).
// Extiende Session/AdapterUser con los campos custom de PlayerSchema
// (ver SPECIFICATION-SUMMARY.md §3) que Auth.js no conoce por defecto.

type PlayerFields = {
  stars: number;
  role: "player" | "admin";
  unlockedPlanets: string[];
  displayName: string;
  firstName: string;
  lastName: string;
  // Registro obligatorio de alias/nombre/apellido (2026-07-22) — ver
  // AGENTS.md §6.4. `false` gatea la pantalla de onboarding.
  profileCompleted: boolean;
  // Ver AGENTS.md §6.5 — gatea el chat en vivo de multijugador. Derivado de
  // la fecha de nacimiento en el servidor, nunca se expone la fecha en sí.
  isAdult: boolean;
  // Ver AGENTS.md §6.6 — sistema de denuncias/amonestaciones. `true` bloquea
  // toda la app (BannedGate.tsx) tras la 3ª amonestación aprobada por un admin.
  banned: boolean;
};

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & PlayerFields & { id: string };
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser extends PlayerFields {
    id: string;
  }
}
