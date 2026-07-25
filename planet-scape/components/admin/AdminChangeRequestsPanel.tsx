"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./Admin.module.css";

type ChangeRequestRow = {
  id: string;
  requesterDisplayName: string;
  requesterEmail: string;
  fields: string[];
  requestedValues: string;
  justification: string;
  status: "pending" | "reviewing" | "approved" | "rejected";
  createdAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  firstName: "firstNameLabel",
  lastName: "lastNameLabel",
  birthDate: "birthDateLabel",
  email: "changeRequestEmailField",
};

/**
 * Solicitudes de cambio de datos sensibles (nombre/apellido/fecha de
 * nacimiento/correo principal) — ver AGENTS.md §6.8. El jugador no puede
 * editar estos campos él mismo; el admin revisa la justificación y, si
 * procede, aplica el cambio a mano desde la pestaña "Jugadores" (esta
 * pantalla solo notifica al jugador, nunca aplica el cambio ella misma).
 */
export function AdminChangeRequestsPanel() {
  const t = useTranslations("Admin");
  const [requests, setRequests] = useState<ChangeRequestRow[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [actionStatus, setActionStatus] = useState<Record<string, "idle" | "saving" | "error">>({});

  const load = async (withResolved: boolean) => {
    setLoading(true);
    if (withResolved) {
      const [approved, rejected, pending] = await Promise.all([
        fetch("/api/admin/profile-change-requests?status=approved").then((r) => r.json()),
        fetch("/api/admin/profile-change-requests?status=rejected").then((r) => r.json()),
        fetch("/api/admin/profile-change-requests").then((r) => r.json()),
      ]);
      setRequests([...(pending.requests ?? []), ...(approved.requests ?? []), ...(rejected.requests ?? [])]);
    } else {
      const res = await fetch("/api/admin/profile-change-requests");
      const data = await res.json();
      setRequests(data.requests ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
  }, []);

  const handleToggleIncludeResolved = (checked: boolean) => {
    setIncludeResolved(checked);
    void load(checked);
  };

  const handleAction = async (id: string, status: "reviewing" | "approved" | "rejected") => {
    setActionStatus((s) => ({ ...s, [id]: "saving" }));
    try {
      const res = await fetch(`/api/admin/profile-change-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminReply: replyDraft[id]?.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setRequests((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
      setActionStatus((s) => ({ ...s, [id]: "idle" }));
    } catch {
      setActionStatus((s) => ({ ...s, [id]: "error" }));
    }
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>{t("changeRequestsSectionTitle")}</h2>
      <p className={styles.status}>{t("changeRequestsHint")}</p>

      <label className={styles.includeReadRow}>
        <input type="checkbox" checked={includeResolved} onChange={(e) => handleToggleIncludeResolved(e.target.checked)} />
        {t("includeResolvedLabel")}
      </label>

      {loading && <p className={styles.status}>{t("loading")}</p>}
      {!loading && requests.length === 0 && <p className={styles.status}>{t("noChangeRequests")}</p>}

      <ul className={styles.playerList}>
        {requests.map((r) => (
          <li key={r.id} className={styles.feedbackRow} data-read={r.status !== "pending"}>
            <div className={styles.feedbackMeta}>
              <span>
                🔒 <strong>{r.requesterDisplayName}</strong> · {r.requesterEmail}
              </span>
              <span className={styles.status}>
                {t("reportStatusLabel")}: {r.status}
              </span>
            </div>
            <p className={styles.feedbackMessage}>
              {t("changeRequestFieldsLabel")}: {r.fields.map((f) => t(FIELD_LABELS[f] ?? f)).join(", ")}
            </p>
            <p className={styles.feedbackMessage}>
              {t("changeRequestValuesLabel")}: {r.requestedValues}
            </p>
            <p className={styles.feedbackMessage}>{r.justification}</p>

            {r.status !== "approved" && r.status !== "rejected" && (
              <>
                <input
                  type="text"
                  className={styles.fieldInputWide}
                  placeholder={t("adminReplyPlaceholder")}
                  value={replyDraft[r.id] ?? ""}
                  onChange={(e) => setReplyDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                />
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={styles.searchButton}
                    disabled={actionStatus[r.id] === "saving"}
                    onClick={() => handleAction(r.id, "reviewing")}
                  >
                    {t("reportMarkReviewing")}
                  </button>
                  <button
                    type="button"
                    className={styles.searchButton}
                    disabled={actionStatus[r.id] === "saving"}
                    onClick={() => handleAction(r.id, "approved")}
                  >
                    {t("changeRequestApprove")}
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={actionStatus[r.id] === "saving"}
                    onClick={() => handleAction(r.id, "rejected")}
                  >
                    {t("reportReject")}
                  </button>
                </div>
                {actionStatus[r.id] === "error" && (
                  <span className={styles.status} data-tone="error">
                    {t("reportActionError")}
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
