"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FeedbackEntry } from "@/lib/schemas/feedback";
import styles from "./Admin.module.css";

const SENTIMENT_EMOJI: Record<string, string> = { positive: "👍", negative: "👎", neutral: "💬" };

/**
 * Administración de comentarios/sugerencias — pedido explícito del usuario
 * (2026-07-22), ver AGENTS.md §2.3. Por defecto solo muestra los NO
 * leídos; marcar como leído es una BAJA LÓGICA (nunca borra de Mongo, ver
 * app/api/admin/feedback/[id]/read/route.ts) — el checkbox "Incluir ya
 * leídos" los vuelve a traer sin importar esa baja lógica.
 */
export function AdminFeedbackPanel() {
  const t = useTranslations("Admin");
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [includeRead, setIncludeRead] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (withRead: boolean) => {
    setLoading(true);
    const res = await fetch(`/api/admin/feedback?includeRead=${withRead}`);
    const data = await res.json();
    setEntries(data.entries ?? []);
    setLoading(false);
  };

  // Solo la carga INICIAL vive en un efecto (mount-only) — el toggle de
  // abajo dispara su propia recarga directamente en el manejador del
  // evento, no reaccionando a un cambio de estado (ver React docs sobre
  // efectos: fetch en respuesta a un evento del usuario va en el handler).
  // El lint marca `setLoading(true)` (primera línea de `load`, síncrona
  // antes del primer `await`) como "setState síncrono dentro de un
  // efecto" — es el patrón estándar de "fetch al montar" que la propia
  // documentación de React usa como ejemplo válido de efecto, no el
  // anti-patrón real que la regla busca (sincronizar estado derivado de
  // una prop, ver el fix aplicado antes en AdminViewToggle.tsx).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
  }, []);

  const handleToggleIncludeRead = (checked: boolean) => {
    setIncludeRead(checked);
    void load(checked);
  };

  const toggleRead = async (id: string, currentlyRead: boolean) => {
    await fetch(`/api/admin/feedback/${id}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: !currentlyRead }),
    });
    // Si ahora está oculto por la baja lógica (se marcó leído y no estamos
    // incluyendo leídos), lo quita de la vista; si no, solo actualiza su estado.
    setEntries((list) =>
      !includeRead && !currentlyRead
        ? list.filter((f) => f.id !== id)
        : list.map((f) => (f.id === id ? { ...f, read: !currentlyRead } : f)),
    );
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>{t("feedbackSectionTitle")}</h2>

      <label className={styles.includeReadRow}>
        <input type="checkbox" checked={includeRead} onChange={(e) => handleToggleIncludeRead(e.target.checked)} />
        {t("includeReadLabel")}
      </label>

      {loading && <p className={styles.status}>{t("loading")}</p>}
      {!loading && entries.length === 0 && <p className={styles.status}>{t("noFeedback")}</p>}

      <ul className={styles.playerList}>
        {entries.map((f) => (
          <li key={f.id} className={styles.feedbackRow} data-read={f.read}>
            <div className={styles.feedbackMeta}>
              <span>
                {SENTIMENT_EMOJI[f.sentiment] ?? "💬"} <strong>{f.displayName}</strong> · {f.email}
              </span>
              <span className={styles.status}>{new Date(f.createdAt).toLocaleString()}</span>
            </div>
            <p className={styles.feedbackMessage}>{f.message}</p>
            <button type="button" className={styles.searchButton} onClick={() => toggleRead(f.id, f.read)}>
              {f.read ? t("markUnreadButton") : t("markReadButton")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
