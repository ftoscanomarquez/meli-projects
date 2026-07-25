"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Estado global de baja frecuencia (sesión, locale, config cacheada) — ver
 * AGENTS.md §3.1 y §12 regla 8. El loop de juego a 60 FPS NUNCA usa este
 * contexto: vive en Zustand fuera de React (ver engine/store, Fase 3).
 *
 * `session` se hidrata en el servidor (app/[locale]/layout.tsx, vía
 * Auth.js `auth()`) y se pasa como `initialSession` — nunca se vuelve a
 * pedir por su cuenta desde el cliente (ver AGENTS.md §5.1 mapa Server/Client).
 */

export type PlayerSession = {
  playerId: string;
  email: string;
  displayName: string;
  stars: number;
  role: "player" | "admin";
  // Planetas premium ya comprados con estrellas (Júpiter/Saturno) — ver
  // AGENTS.md §5/§9 y app/api/planets/unlock/route.ts. Antes no se
  // propagaba desde la sesión de Auth.js hasta aquí.
  unlockedPlanets: string[];
  firstName: string;
  lastName: string;
  // Registro obligatorio de alias/nombre/apellido (2026-07-22) — ver
  // AGENTS.md §6.4. `ProfileOnboarding.tsx` se muestra mientras sea `false`.
  profileCompleted: boolean;
  // Ver AGENTS.md §6.5 — gatea el botón/panel de chat en vivo del multijugador.
  isAdult: boolean;
  // Ver AGENTS.md §6.6 — sistema de denuncias/amonestaciones. `BannedGate.tsx`
  // bloquea toda la app mientras esto sea `true`.
  banned: boolean;
} | null;

type GlobalContextValue = {
  locale: string;
  session: PlayerSession;
  setSession: (session: PlayerSession) => void;
  // "Ver como jugador/admin" (ver lib/actions/adminView.ts) — leído del
  // cookie en el servidor, no forma parte de PlayerSession (no viene de
  // Auth.js/Mongo, es una preferencia de vista puramente cosmética).
  adminViewRole: "admin" | "player";
};

const GlobalContext = createContext<GlobalContextValue | null>(null);

export function GlobalContextProvider({
  locale,
  initialSession,
  initialAdminViewRole = "admin",
  children,
}: {
  locale: string;
  initialSession: PlayerSession;
  initialAdminViewRole?: "admin" | "player";
  children: ReactNode;
}) {
  const [session, setSession] = useState<PlayerSession>(initialSession);

  const value = useMemo(
    () => ({ locale, session, setSession, adminViewRole: initialAdminViewRole }),
    [locale, session, initialAdminViewRole],
  );

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
}

export function useGlobalContext() {
  const ctx = useContext(GlobalContext);
  if (!ctx) {
    throw new Error("useGlobalContext debe usarse dentro de GlobalContextProvider");
  }
  return ctx;
}
