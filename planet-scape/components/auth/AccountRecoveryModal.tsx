"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import styles from "./AccountRecoveryModal.module.css";

type RecoveryResult = "not_found" | "no_phone" | "sent" | "send_failed" | null;

/**
 * Recuperación de cuenta por alias + fecha de nacimiento — pedido explícito
 * del usuario (2026-07-22, ver AGENTS.md §6.7): para quien no recuerda su
 * correo pero sí su alias. Sin sesión a propósito (ver
 * app/api/account/recover/route.ts) — se abre desde un enlace en el propio
 * formulario de login (AuthStatus.tsx).
 */
export function AccountRecoveryModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("AccountRecovery");
  const [alias, setAlias] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RecoveryResult>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/account/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: alias.trim(), birthDate }),
      });
      const body = await res.json();
      setResult(body.status ?? "not_found");
    } catch {
      setResult("send_failed");
    } finally {
      setSubmitting(false);
    }
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  // Portal a document.body — mismo motivo que MyProfileModal.tsx: este
  // modal se renderiza como descendiente de `.widget` en AuthStatus.tsx
  // (position:fixed + z-index propio en escritorio), que atrapa el z-index
  // del modal dentro de su propio contexto de apilamiento.
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <button type="button" className={styles.closeButton} aria-label={t("close")} onClick={onClose}>
          ✕
        </button>
        <h3 className={styles.title}>{t("title")}</h3>
        <p className={styles.hint}>{t("hint")}</p>

        {!result && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>{t("aliasLabel")}</span>
              <input
                type="text"
                required
                maxLength={20}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{t("birthDateLabel")}</span>
              <input
                type="date"
                required
                max={todayIso}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={styles.input}
              />
            </label>
            <button type="submit" className={styles.submitButton} disabled={submitting}>
              {submitting ? t("submitting") : t("submitCta")}
            </button>
          </form>
        )}

        {result === "not_found" && <p className={styles.resultError}>{t("notFound")}</p>}
        {result === "no_phone" && <p className={styles.resultError}>{t("noPhone")}</p>}
        {result === "send_failed" && <p className={styles.resultError}>{t("sendFailed")}</p>}
        {result === "sent" && <p className={styles.resultOk}>{t("sent")}</p>}
      </div>
    </div>,
    document.body,
  );
}
