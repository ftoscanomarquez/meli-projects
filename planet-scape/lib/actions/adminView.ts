"use server";

import { cookies } from "next/headers";

/**
 * Selector "ver como jugador / ver como admin" — pedido explícito del
 * usuario (2026-07-22): "cuando la app detecte que es administrador debe
 * permitirte elegir entre rol jugador o rol administrador, para poder
 * validar el rol de admin" sin necesitar una segunda cuenta.
 *
 * Es puramente cosmético/de vista: solo afecta lo que `/admin` (Server
 * Component) decide RENDERIZAR. La verificación real de seguridad
 * (`lib/adminGuard.ts#requireAdminSession`, usada por cada Route Handler de
 * `/api/admin/*`) nunca lee esta cookie — siempre confía en `players.role`
 * de la base de datos, así que "ver como jugador" nunca puede usarse para
 * saltarse la protección real de las rutas de admin.
 */
const COOKIE_NAME = "admin_view_role";

export async function setAdminViewRole(role: "admin" | "player") {
  const store = await cookies();
  store.set(COOKIE_NAME, role, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
}

export async function getAdminViewRole(): Promise<"admin" | "player"> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return value === "player" ? "player" : "admin";
}
