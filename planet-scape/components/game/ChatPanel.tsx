"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { MultiplayerConfig } from "@/engine/multiplayer/types";
import { useDraggablePanel } from "@/lib/hooks/useDraggablePanel";
import styles from "./ChatPanel.module.css";

type ChatEntry = { id: string; displayName: string; message: string; sentAt: number };

/**
 * Chat de texto en vivo entre compañeros de partida — pedido explícito del
 * usuario (2026-07-22, ver AGENTS.md §6.5): "permite en el juego una opción
 * para que los que jueguen en modo partida o en equipo haya un botón que
 * permita una comunicación con los demás jugadores, pero solo si eres mayor
 * de 18 años". Solo se renderiza si `multiplayerConfig.allPlayersAdult` es
 * `true` — calculado server-side (ver party/gameRoom.ts), esta UI ni
 * siquiera existe en el DOM para una sala con un menor, pero el
 * cumplimiento REAL vive en el servidor (ver AGENTS.md §6.5), no aquí.
 *
 * Incluye un botón "🚩" de denuncia por mensaje (ver AGENTS.md §6.6) — pre-
 * llena alias y fecha/hora del incidente a partir del propio mensaje, para
 * que el admin pueda buscarlo después en el histórico de chat.
 */
export function ChatPanel({ multiplayerConfig }: { multiplayerConfig: MultiplayerConfig }) {
  const t = useTranslations("Chat");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [reportTarget, setReportTarget] = useState<ChatEntry | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Ventana movible — pedido explícito del usuario (2026-07-23): "que la
  // ventana que se abre se pueda mover de lugar arrastrandola para que el
  // jugador en mobile la pueda cambiar de lugar".
  const { style: dragStyle, dragging, handleProps } = useDraggablePanel(panelRef);

  useEffect(() => {
    return multiplayerConfig.onChatMessage((msg) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
    });
  }, [multiplayerConfig]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    multiplayerConfig.sendChatMessage(trimmed);
    setDraft("");
  };

  return (
    <>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("toggleAria")}
      >
        💬
      </button>

      {open && (
        <div className={styles.panel} ref={panelRef} style={dragStyle}>
          <div className={styles.header} data-dragging={dragging} {...handleProps}>
            <span>{t("title")}</span>
            <button type="button" className={styles.closePanel} onClick={() => setOpen(false)} aria-label={t("close")}>
              ✕
            </button>
          </div>

          <div className={styles.list} ref={listRef}>
            {messages.length === 0 && <p className={styles.empty}>{t("empty")}</p>}
            {messages.map((m, i) => {
              const isLocal = m.displayName === multiplayerConfig.localDisplayName;
              return (
                <div key={i} className={styles.entry} data-own={isLocal}>
                  <div className={styles.entryHeader}>
                    <span className={styles.entryName} data-own={isLocal}>
                      {m.displayName}
                    </span>
                    {!isLocal && (
                      <button
                        type="button"
                        className={styles.reportButton}
                        title={t("reportCta")}
                        onClick={() => setReportTarget(m)}
                      >
                        🚩
                      </button>
                    )}
                  </div>
                  <p className={styles.entryMessage}>{m.message}</p>
                </div>
              );
            })}
          </div>

          <form className={styles.form} onSubmit={handleSend}>
            <input
              type="text"
              maxLength={300}
              placeholder={t("placeholder")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={styles.input}
            />
            <button type="submit" className={styles.sendButton} disabled={!draft.trim()}>
              {t("send")}
            </button>
          </form>
        </div>
      )}

      {reportTarget && (
        <ReportDialog
          target={reportTarget}
          roomId={multiplayerConfig.roomId}
          onClose={() => setReportTarget(null)}
        />
      )}
    </>
  );
}

/** Formulario de denuncia — ver AGENTS.md §6.6. Prellena alias + fecha/hora del mensaje reportado. */
function ReportDialog({ target, roomId, onClose }: { target: ChatEntry; roomId: string; onClose: () => void }) {
  const t = useTranslations("Chat");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedAlias: target.displayName,
          incidentAt: new Date(target.sentAt).toISOString(),
          roomId,
          description: description.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.reportOverlay} role="dialog" aria-modal="true">
      <div className={styles.reportCard}>
        <button type="button" className={styles.closePanel} onClick={onClose} aria-label={t("close")}>
          ✕
        </button>
        <h3 className={styles.reportTitle}>{t("reportTitle", { alias: target.displayName })}</h3>
        <p className={styles.reportHint}>
          {t("reportIncidentAt", { datetime: new Date(target.sentAt).toLocaleString() })}
        </p>

        {sent ? (
          <p className={styles.reportSent}>{t("reportSent")}</p>
        ) : (
          <form className={styles.reportForm} onSubmit={handleSubmit}>
            <textarea
              required
              minLength={10}
              maxLength={1000}
              placeholder={t("reportDescriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.reportTextarea}
            />
            <button type="submit" className={styles.reportSubmit} disabled={submitting}>
              {submitting ? t("reportSubmitting") : t("reportSubmit")}
            </button>
            {error && <p className={styles.reportError}>{t("reportError")}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
