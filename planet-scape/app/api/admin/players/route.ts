import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import type { PlayerSearchResult } from "@/lib/schemas/admin";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PAGE_SIZE = 20;

/**
 * GET /api/admin/players — ver AGENTS.md §9. Dos modos:
 * - `?search=<email>` (≥2 caracteres): búsqueda por email, hasta 20
 *   resultados (comportamiento original, Fase 8).
 * - `?page=<n>` (sin `search`, o `search` vacío): lista TODOS los jugadores,
 *   paginada — pedido explícito del usuario (2026-07-22): "un botón que te
 *   permita listar todos los jugadores... coloca una lista paginada".
 */
export async function GET(request: Request) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const db = await getDb();
  const collection = db.collection("players");

  // Proyección compartida — incluye birthDate/phone/unlockedPlanets para el
  // modal de edición del admin (2026-07-22, ver AGENTS.md §6.8; planetas
  // premium agregados 2026-07-24, ver AGENTS.md §9).
  const projection = {
    email: 1,
    displayName: 1,
    firstName: 1,
    lastName: 1,
    stars: 1,
    role: 1,
    birthDate: 1,
    phone: 1,
    unlockedPlanets: 1,
  };

  if (search.length >= 2) {
    const docs = await collection
      .find({ email: { $regex: escapeRegExp(search), $options: "i" } }, { projection, limit: 20 })
      .toArray();
    return NextResponse.json({ players: docs.map(toResult), mode: "search" as const });
  }

  // Modo "listar todos", paginado.
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const total = await collection.countDocuments({});
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const docs = await collection
    .find({}, { projection })
    .sort({ email: 1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();

  return NextResponse.json({ players: docs.map(toResult), mode: "all" as const, page, totalPages, total });
}

function toResult(d: Record<string, unknown>): PlayerSearchResult {
  return {
    id: String(d._id),
    email: String(d.email ?? ""),
    displayName: String(d.displayName ?? d.email ?? ""),
    firstName: String(d.firstName ?? ""),
    lastName: String(d.lastName ?? ""),
    stars: Number(d.stars ?? 0),
    role: d.role === "admin" ? "admin" : "player",
    birthDate: d.birthDate instanceof Date ? d.birthDate.toISOString().slice(0, 10) : null,
    phone: d.phone ? String(d.phone) : null,
    unlockedPlanets: Array.isArray(d.unlockedPlanets) ? d.unlockedPlanets.map(String) : [],
  };
}
