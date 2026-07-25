"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import styles from "./FeedbackButton.module.css";

type Sentiment = "positive" | "negative" | "neutral";
type Mode = "comment" | "report";

/**
 * Comentarios y sugerencias de los jugadores — pedido explícito del usuario
 * (2026-07-22): "para que los jugadores puedan dejar sus opiniones buenas y
 * malas". Botón flotante (igual patrón que DonationButton.tsx) que abre un
 * formulario simple: mensaje + un selector opcional de tono (👍/👎/💬).
 * Requiere sesión — ver app/api/feedback/route.ts.
 *
 * Pestaña de denuncia agregada (2026-07-23) — pedido explícito del usuario:
 * "la parte de denunciar acoso por parte de otro jugador no lo he visto
 * solo lo vi creo en el admin, pero como jugador no vi donde lo denuncia...
 * colocalo como parte de comentarios una opcion para denunciar acoso o
 * agresiones por cierto jugador". Antes la ÚNICA forma de denunciar era el
 * botón 🚩 dentro de `ChatPanel.tsx`, sobre un mensaje puntual — solo
 * disponible en pleno multijugador con chat habilitado. Esta pestaña
 * reutiliza el mismo `POST /api/reports` (`lib/schemas/report.ts`) que ya
 * exigía únicamente alias + fecha/hora del incidente + descripción, sin
 * depender de un mensaje de chat concreto — así cualquier jugador logueado
 * puede denunciar desde la landing, en cualquier momento.
 */
export function FeedbackButton() {
  const t = useTranslations("Feedback");
  const { session } = useGlobalContext();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("comment");
  const [message, setMessage] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment>("neutral");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Campos del formulario de denuncia — fecha/hora separadas en el
  // formulario y combinadas en un solo ISO antes de enviarse, mismo patrón
  // que `ReportDialog` en ChatPanel.tsx.
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toISOString().slice(11, 16);
  const [reportedAlias, setReportedAlias] = useState("");
  const [incidentDate, setIncidentDate] = useState(today);
  const [incidentTime, setIncidentTime] = useState(nowTime);
  const [reportRoomId, setReportRoomId] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  if (!session) return null; // el formulario necesita sesión — ver la ruta

  const resetAndClose = () => {
    setOpen(false);
    setStatus("idle");
    setMode("comment");
    setMessage("");
    setSentiment("neutral");
    setReportedAlias("");
    setReportRoomId("");
    setReportDescription("");
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), sentiment }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
      setTimeout(resetAndClose, 1200);
    } catch {
      setStatus("error");
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportedAlias.trim() || reportDescription.trim().length < 10) return;
    setStatus("sending");
    try {
      const incidentAt = new Date(`${incidentDate}T${incidentTime}:00`).toISOString();
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedAlias: reportedAlias.trim(),
          incidentAt,
          roomId: reportRoomId.trim() || undefined,
          description: reportDescription.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
      setTimeout(resetAndClose, 1200);
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <button type="button" className={styles.floatingButton} onClick={() => setOpen(true)}>
        💬 {t("buttonLabel")}
      </button>

      {open && (
        <div className={styles.overlay} role="dialog" aria-modal="true" onClick={resetAndClose}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.closeButton} aria-label={t("close")} onClick={resetAndClose}>
              ✕
            </button>

            <div className={styles.modeTabs}>
              <button type="button" className={styles.modeTab} data-active={mode === "comment"} onClick={() => setMode("comment")}>
                💬 {t("commentTabLabel")}
              </button>
              <button type="button" className={styles.modeTab} data-active={mode === "report"} onClick={() => setMode("report")}>
                🚩 {t("reportTabLabel")}
              </button>
            </div>

            {mode === "comment" ? (
              <form onSubmit={handleSubmitComment} className={styles.form}>
                <h3 className={styles.title}>{t("title")}</h3>
                <p className={styles.hint}>{t("hint")}</p>

                <div className={styles.sentimentRow}>
                  <button
                    type="button"
                    className={styles.sentimentOption}
                    data-active={sentiment === "positive"}
                    onClick={() => setSentiment("positive")}
                  >
                    👍 {t("positive")}
                  </button>
                  <button
                    type="button"
                    className={styles.sentimentOption}
                    data-active={sentiment === "neutral"}
                    onClick={() => setSentiment("neutral")}
                  >
                    💬 {t("neutral")}
                  </button>
                  <button
                    type="button"
                    className={styles.sentimentOption}
                    data-active={sentiment === "negative"}
                    onClick={() => setSentiment("negative")}
                  >
                    👎 {t("negative")}
                  </button>
                </div>

                <textarea
                  className={styles.textarea}
                  placeholder={t("placeholder")}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  required
                />

                <button type="submit" className={styles.submitButton} disabled={status === "sending" || !message.trim()}>
                  {status === "sending" ? t("sending") : t("submitCta")}
                </button>
                {status === "sent" && <p className={styles.successText}>{t("sent")}</p>}
                {status === "error" && <p className={styles.errorText}>{t("error")}</p>}
              </form>
            ) : (
              <form onSubmit={handleSubmitReport} className={styles.form}>
                <h3 className={styles.title}>{t("reportModeTitle")}</h3>
                <p className={styles.hint}>{t("reportModeHint")}</p>

                <label className={styles.fieldLabel}>
                  {t("reportAliasLabel")}
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder={t("reportAliasPlaceholder")}
                    value={reportedAlias}
                    onChange={(e) => setReportedAlias(e.target.value)}
                    maxLength={30}
                    required
                  />
                </label>

                <div className={styles.dateTimeRow}>
                  <label className={styles.fieldLabel}>
                    {t("reportDateLabel")}
                    <input
                      type="date"
                      className={styles.textInput}
                      value={incidentDate}
                      max={today}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      required
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    {t("reportTimeLabel")}
                    <input
                      type="time"
                      className={styles.textInput}
                      value={incidentTime}
                      onChange={(e) => setIncidentTime(e.target.value)}
                      required
                    />
                  </label>
                </div>

                <label className={styles.fieldLabel}>
                  {t("reportRoomLabel")}
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder={t("reportRoomPlaceholder")}
                    value={reportRoomId}
                    onChange={(e) => setReportRoomId(e.target.value)}
                    maxLength={20}
                  />
                </label>

                <textarea
                  className={styles.textarea}
                  placeholder={t("reportDescriptionPlaceholder")}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  required
                />

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={status === "sending" || !reportedAlias.trim() || reportDescription.trim().length < 10}
                >
                  {status === "sending" ? t("sending") : t("reportSubmitCta")}
                </button>
                {status === "sent" && <p className={styles.successText}>{t("reportSent")}</p>}
                {status === "error" && <p className={styles.errorText}>{t("reportError")}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
