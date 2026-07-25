"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./Admin.module.css";

type ReportRow = {
  id: string;
  reporterDisplayName: string;
  reportedAlias: string;
  reportedPlayerId: string | null;
  incidentAt: string;
  roomId: string | null;
  description: string;
  status: "pending" | "reviewing" | "approved" | "rejected";
  createdAt: string;
};

/**
 * Panel de moderación de denuncias — pedido explícito del usuario
 * (2026-07-22, ver AGENTS.md §6.6). El admin revisa manualmente (usando
 * AdminChatPanel para buscar el histórico por roomId/alias/fecha) antes de
 * decidir: "atender" (notifica al denunciante), "aprobar" (amonesta al
 * denunciado — strike +1, banea a la 3ª) o "rechazar".
 */
export function AdminReportsPanel() {
  const t = useTranslations("Admin");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [actionStatus, setActionStatus] = useState<Record<string, "idle" | "saving" | "error">>({});

  const load = async (withResolved: boolean) => {
    setLoading(true);
    const url = withResolved ? "/api/admin/reports?status=approved" : "/api/admin/reports";
    // `withResolved` trae aprobadas Y rechazadas — dos llamadas porque la
    // ruta solo filtra por un único status a la vez (ver
    // app/api/admin/reports/route.ts); sin resolver, la ruta ya devuelve
    // pending+reviewing por defecto.
    if (withResolved) {
      const [approved, rejected, pending] = await Promise.all([
        fetch("/api/admin/reports?status=approved").then((r) => r.json()),
        fetch("/api/admin/reports?status=rejected").then((r) => r.json()),
        fetch("/api/admin/reports").then((r) => r.json()),
      ]);
      setReports([...(pending.reports ?? []), ...(approved.reports ?? []), ...(rejected.reports ?? [])]);
    } else {
      const res = await fetch(url);
      const data = await res.json();
      setReports(data.reports ?? []);
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
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminReply: replyDraft[id]?.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setReports((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
      setActionStatus((s) => ({ ...s, [id]: "idle" }));
    } catch {
      setActionStatus((s) => ({ ...s, [id]: "error" }));
    }
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>{t("reportsSectionTitle")}</h2>

      <label className={styles.includeReadRow}>
        <input type="checkbox" checked={includeResolved} onChange={(e) => handleToggleIncludeResolved(e.target.checked)} />
        {t("includeResolvedLabel")}
      </label>

      {loading && <p className={styles.status}>{t("loading")}</p>}
      {!loading && reports.length === 0 && <p className={styles.status}>{t("noReports")}</p>}

      <ul className={styles.playerList}>
        {reports.map((r) => (
          <li key={r.id} className={styles.feedbackRow} data-read={r.status !== "pending"}>
            <div className={styles.feedbackMeta}>
              <span>
                🚩 <strong>{r.reporterDisplayName}</strong> {t("reportAgainst")} <strong>{r.reportedAlias}</strong>
                {!r.reportedPlayerId && ` (${t("reportUnresolvedAlias")})`}
              </span>
              <span className={styles.status}>
                {t("reportStatusLabel")}: {r.status}
              </span>
            </div>
            <p className={styles.feedbackMessage}>
              {t("reportIncidentLabel")}: {new Date(r.incidentAt).toLocaleString()}
              {r.roomId ? ` · ${t("reportRoomLabel")}: ${r.roomId}` : ""}
            </p>
            <p className={styles.feedbackMessage}>{r.description}</p>

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
                    className={styles.deleteButton}
                    disabled={actionStatus[r.id] === "saving"}
                    onClick={() => handleAction(r.id, "approved")}
                  >
                    {t("reportApprove")}
                  </button>
                  <button
                    type="button"
                    className={styles.searchButton}
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
