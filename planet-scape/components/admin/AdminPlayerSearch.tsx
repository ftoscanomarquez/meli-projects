"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PlayerSearchResult } from "@/lib/schemas/admin";
import { PREMIUM_PLANET_KEYS } from "@/engine/characterSvg";
import styles from "./Admin.module.css";

type AdjustState = Record<string, { value: string; status: "idle" | "saving" | "saved" | "error" }>;
// `birthDate`/`phone` agregados (2026-07-22, pedido explícito del usuario:
// "que permita editar su fecha de cumpleaños o su número de celular") — ver
// AGENTS.md §6.8. `birthDate` en formato `YYYY-MM-DD` para el `<input type="date">`.
// `unlockedPlanets` agregado (2026-07-24, ver AGENTS.md §9): "un checkbox
// de los planetas desbloqueados... para en caso de ser necesario volverlo
// a deshabilitar".
type ProfileEditState = {
  firstName: string;
  lastName: string;
  alias: string;
  birthDate: string;
  phone: string;
  unlockedPlanets: string[];
};

/**
 * Búsqueda de jugadores + ajuste manual de estrellas (Fase 8) — ver
 * AGENTS.md §9. Ampliado (2026-07-22, pedido explícito del usuario):
 * (1) botón "Listar todos" con paginación, además de la búsqueda por email;
 * (2) el admin puede corregir nombre/apellido/alias de un jugador — solo
 * uno a la vez (`editingId`), nunca varias filas abiertas simultáneamente.
 */
export function AdminPlayerSearch() {
  const t = useTranslations("Admin");
  const tPlanets = useTranslations("Planets");
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<PlayerSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [adjust, setAdjust] = useState<AdjustState>({});

  // Modo "listar todos, paginado" — separado del modo búsqueda.
  const [listMode, setListMode] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Edición de perfil — un único jugador a la vez (nunca varias filas
  // abiertas), pedido explícito del usuario: "solo puedes elegir de a uno".
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProfileEditState>({
    firstName: "",
    lastName: "",
    alias: "",
    birthDate: "",
    phone: "",
    unlockedPlanets: [],
  });
  const [editStatus, setEditStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editError, setEditError] = useState<string | null>(null);

  // Eliminar cuentas — sí varias a la vez (pedido explícito del usuario,
  // 2026-07-22: "para el caso de pruebas"), con confirmación antes de
  // borrar de verdad (nunca `window.confirm`, ver AGENTS.md §12.11).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    setDeleteStatus("deleting");
    setDeleteError(null);
    try {
      const res = await fetch("/api/admin/players/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const body = await res.json();
      if (!res.ok) {
        setDeleteStatus("error");
        setDeleteError(body.error ?? t("deleteError"));
        return;
      }
      setPlayers((list) => list.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setConfirmingDelete(false);
      setDeleteStatus("idle");
    } catch {
      setDeleteStatus("error");
      setDeleteError(t("deleteError"));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setListMode(false);
    setEditingId(null);
    const res = await fetch(`/api/admin/players?search=${encodeURIComponent(query)}`);
    const data = await res.json();
    setPlayers(data.players ?? []);
    setSearched(true);
  };

  const loadAllPlayers = async (targetPage: number) => {
    setListMode(true);
    setSearched(true);
    setEditingId(null);
    const res = await fetch(`/api/admin/players?page=${targetPage}`);
    const data = await res.json();
    setPlayers(data.players ?? []);
    setPage(data.page ?? targetPage);
    setTotalPages(data.totalPages ?? 1);
  };

  const handleAdjust = async (playerId: string) => {
    const raw = adjust[playerId]?.value ?? "";
    const amount = Number(raw);
    if (!raw || Number.isNaN(amount) || amount === 0) return;

    setAdjust((s) => ({ ...s, [playerId]: { value: raw, status: "saving" } }));
    try {
      const res = await fetch(`/api/admin/players/${playerId}/stars`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { stars } = await res.json();
      setPlayers((list) => list.map((p) => (p.id === playerId ? { ...p, stars } : p)));
      setAdjust((s) => ({ ...s, [playerId]: { value: "", status: "saved" } }));
    } catch {
      setAdjust((s) => ({ ...s, [playerId]: { value: raw, status: "error" } }));
    }
  };

  const startEditing = (p: PlayerSearchResult) => {
    setEditingId(p.id);
    setEditForm({
      firstName: p.firstName,
      lastName: p.lastName,
      alias: p.displayName,
      birthDate: p.birthDate ?? "",
      phone: p.phone ?? "",
      unlockedPlanets: p.unlockedPlanets,
    });
    setEditStatus("idle");
    setEditError(null);
  };

  const togglePlanetUnlocked = (planet: string) => {
    setEditForm((f) => ({
      ...f,
      unlockedPlanets: f.unlockedPlanets.includes(planet)
        ? f.unlockedPlanets.filter((p) => p !== planet)
        : [...f.unlockedPlanets, planet],
    }));
  };

  const handleSaveProfile = async (playerId: string) => {
    setEditStatus("saving");
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/players/${playerId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const body = await res.json();
      if (!res.ok) {
        setEditStatus("error");
        setEditError(body.error ?? t("profileEditError"));
        return;
      }
      setPlayers((list) =>
        list.map((p) =>
          p.id === playerId
            ? {
                ...p,
                displayName: body.displayName,
                firstName: body.firstName,
                lastName: body.lastName,
                birthDate: body.birthDate ?? p.birthDate,
                phone: body.phone ?? p.phone,
                unlockedPlanets: body.unlockedPlanets ?? p.unlockedPlanets,
              }
            : p,
        ),
      );
      setEditStatus("saved");
      setTimeout(() => setEditingId(null), 900);
    } catch {
      setEditStatus("error");
      setEditError(t("profileEditError"));
    }
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>{t("playersSectionTitle")}</h2>

      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className={styles.searchButton}>
          {t("searchButton")}
        </button>
        <button type="button" className={styles.searchButton} onClick={() => loadAllPlayers(1)}>
          {t("listAllButton")}
        </button>
      </form>

      {searched && players.length === 0 && <p className={styles.status}>{t("noResults")}</p>}

      {selectedIds.size > 0 && (
        <div className={styles.deleteBar}>
          <span className={styles.status}>{t("selectedCount", { count: selectedIds.size })}</span>
          <button type="button" className={styles.deleteButton} onClick={() => setConfirmingDelete(true)}>
            {t("deleteSelectedButton")}
          </button>
        </div>
      )}

      <ul className={styles.playerList}>
        {players.map((p) => {
          const state = adjust[p.id] ?? { value: "", status: "idle" as const };
          return (
            <li key={p.id} className={styles.playerRow}>
              <input
                type="checkbox"
                className={styles.playerCheckbox}
                checked={selectedIds.has(p.id)}
                onChange={() => toggleSelected(p.id)}
                aria-label={t("selectPlayerLabel")}
              />
              <span className={styles.playerEmail}>
                {p.email} <span className={styles.playerAliasHint}>({p.displayName})</span>
              </span>
              <span className={styles.playerStars}>
                ⭐ {p.stars} {t("starsColumnLabel")}
              </span>
              <span className={styles.playerRole}>{p.role}</span>
              {/* Ícono de lápiz + modal (en vez de expandir campos en línea)
                  — pedido explícito del usuario (2026-07-24): "estan
                  abultados y no se ve ni si quiera la descripcion de los
                  campos... que abra un Modal". */}
              <button type="button" className={styles.searchButton} onClick={() => startEditing(p)}>
                ✏️ {t("editProfileButton")}
              </button>
              <form
                className={styles.adjustForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAdjust(p.id);
                }}
              >
                <input
                  type="number"
                  className={styles.adjustInput}
                  placeholder={t("adjustPlaceholder")}
                  value={state.value}
                  onChange={(e) => setAdjust((s) => ({ ...s, [p.id]: { value: e.target.value, status: "idle" } }))}
                />
                <button type="submit" className={styles.searchButton} disabled={state.status === "saving"}>
                  {t("applyButton")}
                </button>
              </form>
              {state.status === "saved" && (
                <span className={styles.status} data-tone="success">
                  {t("adjustSuccess")}
                </span>
              )}
              {state.status === "error" && (
                <span className={styles.status} data-tone="error">
                  {t("adjustError")}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {editingId &&
        (() => {
          const editingPlayer = players.find((p) => p.id === editingId);
          if (!editingPlayer) return null;
          return (
            <div className={styles.confirmOverlay} role="dialog" aria-modal="true">
              <div className={styles.editModalCard}>
                <button
                  type="button"
                  className={styles.editModalClose}
                  aria-label={t("close")}
                  onClick={() => setEditingId(null)}
                >
                  ✕
                </button>
                <h3 className={styles.groupTitle}>{t("editModalTitle")}</h3>
                <p className={styles.playerEmail}>{editingPlayer.email}</p>
                <form
                  className={styles.editModalForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveProfile(editingPlayer.id);
                  }}
                >
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="edit-first-name">
                      {t("firstNameLabel")}
                    </label>
                    <input
                      id="edit-first-name"
                      type="text"
                      className={styles.fieldInputWide}
                      value={editForm.firstName}
                      onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                      required
                    />
                    <span className={styles.fieldHint}>{t("firstNameHint")}</span>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="edit-last-name">
                      {t("lastNameLabel")}
                    </label>
                    <input
                      id="edit-last-name"
                      type="text"
                      className={styles.fieldInputWide}
                      value={editForm.lastName}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                      required
                    />
                    <span className={styles.fieldHint}>{t("lastNameHint")}</span>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="edit-alias">
                      {t("aliasLabel")}
                    </label>
                    <input
                      id="edit-alias"
                      type="text"
                      className={styles.fieldInputWide}
                      value={editForm.alias}
                      onChange={(e) => setEditForm((f) => ({ ...f, alias: e.target.value }))}
                      required
                    />
                    <span className={styles.fieldHint}>{t("aliasHint")}</span>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="edit-birth-date">
                      {t("birthDateLabel")}
                    </label>
                    <input
                      id="edit-birth-date"
                      type="date"
                      className={styles.fieldInputWide}
                      value={editForm.birthDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, birthDate: e.target.value }))}
                    />
                    <span className={styles.fieldHint}>{t("birthDateHint")}</span>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="edit-phone">
                      {t("phoneLabel")}
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      className={styles.fieldInputWide}
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                    <span className={styles.fieldHint}>{t("phoneHint")}</span>
                  </div>

                  {/* Checklist de planetas premium — pedido explícito del
                      usuario (2026-07-24): "un checkbox de los planetas
                      desbloqueados que tenga para en caso de ser necesario
                      volverlo a deshabilitar". */}
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>{t("unlockedPlanetsLabel")}</span>
                    <div className={styles.planetCheckboxList}>
                      {PREMIUM_PLANET_KEYS.map((planet) => (
                        <label key={planet} className={styles.planetCheckboxRow}>
                          <input
                            type="checkbox"
                            checked={editForm.unlockedPlanets.includes(planet)}
                            onChange={() => togglePlanetUnlocked(planet)}
                          />
                          {tPlanets(planet)}
                        </label>
                      ))}
                    </div>
                    <span className={styles.fieldHint}>{t("unlockedPlanetsHint")}</span>
                  </div>

                  <div className={styles.confirmActions}>
                    <button type="button" className={styles.searchButton} onClick={() => setEditingId(null)}>
                      {t("cancelButton")}
                    </button>
                    <button type="submit" className={styles.saveButton} disabled={editStatus === "saving"}>
                      {editStatus === "saving" ? t("saving") : t("saveButton")}
                    </button>
                  </div>
                  {editStatus === "saved" && (
                    <span className={styles.status} data-tone="success">
                      {t("profileEditSuccess")}
                    </span>
                  )}
                  {editStatus === "error" && (
                    <span className={styles.status} data-tone="error">
                      {editError}
                    </span>
                  )}
                </form>
              </div>
            </div>
          );
        })()}

      {listMode && totalPages > 1 && (
        <div className={styles.pagination}>
          <button type="button" className={styles.searchButton} disabled={page <= 1} onClick={() => loadAllPlayers(page - 1)}>
            ‹
          </button>
          <span className={styles.status}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.searchButton}
            disabled={page >= totalPages}
            onClick={() => loadAllPlayers(page + 1)}
          >
            ›
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true">
          <div className={styles.confirmCard}>
            <p className={styles.confirmText}>{t("deleteConfirmBody", { count: selectedIds.size })}</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.searchButton}
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteStatus === "deleting"}
              >
                {t("cancelButton")}
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={handleDeleteSelected}
                disabled={deleteStatus === "deleting"}
              >
                {deleteStatus === "deleting" ? t("deleting") : t("deleteConfirmYes")}
              </button>
            </div>
            {deleteStatus === "error" && (
              <span className={styles.status} data-tone="error">
                {deleteError}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
