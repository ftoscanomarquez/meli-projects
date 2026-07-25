"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import styles from "./MyProfileModal.module.css";

type ProfileData = {
  firstName: string;
  lastName: string;
  email: string;
  alias: string;
  birthDate: string | null;
  phone: string;
  recoveryEmail: string;
  nationality: string;
};

const SENSITIVE_FIELDS = ["firstName", "lastName", "birthDate", "email"] as const;

/**
 * Autoservicio de perfil del jugador — pedido explícito del usuario
 * (2026-07-22, ver AGENTS.md §6.8): "en el panel de administración cuando
 * le das editar a un jugador que permita editar su fecha de cumpleaños o su
 * número de celular, estos datos deben poder ser mostrados como
 * información del perfil del jugador y ellos solamente pueden editar su
 * número de celular, su correo de recuperación... pueden editar su alias,
 * siempre que sea por uno disponible, lo que no pueden cambiar es el
 * correo principal ni nombre ni apellido ni fecha de cumpleaños".
 *
 * Nombre/apellido/fecha de nacimiento/correo principal se muestran de solo
 * lectura con un aviso de que son datos sensibles — para corregirlos hay
 * que enviar una solicitud justificada que revisa un admin (nunca se
 * aplica sola, ver AdminChangeRequestsPanel.tsx).
 */
export function MyProfileModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Profile");
  const { session, setSession } = useGlobalContext();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const [alias, setAlias] = useState("");
  const [phone, setPhone] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [aliasStatus, setAliasStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "unchanged">(
    "unchanged",
  );
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Solicitud de cambio de datos sensibles — colapsada por defecto.
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [requestFields, setRequestFields] = useState<Set<string>>(new Set());
  const [requestedValues, setRequestedValues] = useState("");
  const [justification, setJustification] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    void fetch("/api/profile")
      .then((r) => r.json())
      .then((body: ProfileData) => {
        setData(body);
        setAlias(body.alias);
        setPhone(body.phone);
        setRecoveryEmail(body.recoveryEmail);
        setLoading(false);
      });
  }, []);

  const handleAliasChange = (value: string) => {
    setAlias(value);
    setSuggestion(null);
    setAliasStatus(data && value.trim() === data.alias ? "unchanged" : "idle");
  };

  const handleValidateAlias = async () => {
    if (alias.trim().length < 3) {
      setAliasStatus("invalid");
      return;
    }
    setAliasStatus("checking");
    try {
      const res = await fetch(`/api/profile/check-alias?alias=${encodeURIComponent(alias.trim())}`);
      const body = await res.json();
      if (!res.ok) {
        setAliasStatus("invalid");
        return;
      }
      if (body.available) {
        setAliasStatus("available");
        setSuggestion(null);
      } else {
        setAliasStatus("taken");
        setSuggestion(body.suggestion ?? null);
      }
    } catch {
      setAliasStatus("invalid");
    }
  };

  const handleUseSuggestion = () => {
    if (!suggestion) return;
    setAlias(suggestion);
    setAliasStatus("available");
    setSuggestion(null);
  };

  const canSave = aliasStatus === "available" || aliasStatus === "unchanged";

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: alias.trim(), phone: phone.trim(), recoveryEmail: recoveryEmail.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.code === "ALIAS_TAKEN") setAliasStatus("taken");
        setSaveStatus("error");
        setSaveError(body.error ?? t("saveError"));
        return;
      }
      setSaveStatus("saved");
      setData((d) => (d ? { ...d, alias: body.alias, phone: body.phone, recoveryEmail: body.recoveryEmail } : d));
      setAliasStatus("unchanged");
      // El alias se ve en todo el juego (multijugador, leaderboard) — ver
      // AGENTS.md §6.4 — hay que reflejarlo en la sesión global también.
      if (session) setSession({ ...session, displayName: body.alias });
    } catch {
      setSaveStatus("error");
      setSaveError(t("saveError"));
    }
  };

  const toggleRequestField = (field: string) => {
    setRequestFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const handleSubmitChangeRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (requestFields.size === 0) return;
    setRequestStatus("sending");
    try {
      const res = await fetch("/api/profile/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: Array.from(requestFields),
          requestedValues: requestedValues.trim(),
          justification: justification.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      setRequestStatus("sent");
    } catch {
      setRequestStatus("error");
    }
  };

  // Portal a document.body: AuthStatus.tsx renderiza este modal como
  // descendiente de `.widget` (position:fixed + z-index propio en escritorio,
  // ver AuthStatus.module.css), lo que crea su propio contexto de apilamiento
  // y "atrapa" cualquier z-index del modal dentro de él sin importar qué tan
  // alto sea — por eso el modal seguía quedando detrás del carrusel de
  // planetas (z-index hasta 100) aunque su .overlay ya tuviera z-index:200.
  // El Portal escapa ese contexto de apilamiento por completo.
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <button type="button" className={styles.closeButton} aria-label={t("close")} onClick={onClose}>
          ✕
        </button>
        <h2 className={styles.title}>{t("title")}</h2>

        {loading || !data ? (
          <p className={styles.hint}>{t("loading")}</p>
        ) : (
          <>
            {/* Datos sensibles — solo lectura, ver AGENTS.md §6.8 */}
            <div className={styles.lockedSection}>
              <p className={styles.sensitiveNotice}>🔒 {t("sensitiveNotice")}</p>
              <div className={styles.lockedGrid}>
                <span className={styles.lockedLabel}>{t("firstNameLabel")}</span>
                <span className={styles.lockedValue}>{data.firstName}</span>
                <span className={styles.lockedLabel}>{t("lastNameLabel")}</span>
                <span className={styles.lockedValue}>{data.lastName}</span>
                <span className={styles.lockedLabel}>{t("emailLabel")}</span>
                <span className={styles.lockedValue}>{data.email}</span>
                <span className={styles.lockedLabel}>{t("birthDateLabel")}</span>
                <span className={styles.lockedValue}>{data.birthDate ?? "—"}</span>
              </div>
              <button type="button" className={styles.linkButton} onClick={() => setShowChangeRequest((v) => !v)}>
                {showChangeRequest ? t("hideChangeRequest") : t("requestChangeCta")}
              </button>
            </div>

            {showChangeRequest && (
              <form className={styles.changeRequestForm} onSubmit={handleSubmitChangeRequest}>
                <p className={styles.hint}>{t("changeRequestWarning")}</p>
                <div className={styles.checkboxRow}>
                  {SENSITIVE_FIELDS.map((field) => (
                    <label key={field} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={requestFields.has(field)}
                        onChange={() => toggleRequestField(field)}
                      />
                      {t(field === "email" ? "emailLabel" : `${field}Label`)}
                    </label>
                  ))}
                </div>
                <textarea
                  required
                  className={styles.textarea}
                  placeholder={t("requestedValuesPlaceholder")}
                  value={requestedValues}
                  onChange={(e) => setRequestedValues(e.target.value)}
                  maxLength={500}
                />
                <textarea
                  required
                  minLength={10}
                  className={styles.textarea}
                  placeholder={t("justificationPlaceholder")}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  maxLength={1000}
                />
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={requestFields.size === 0 || requestStatus === "sending"}
                >
                  {requestStatus === "sending" ? t("sending") : t("submitChangeRequest")}
                </button>
                {requestStatus === "sent" && <p className={styles.successText}>{t("changeRequestSent")}</p>}
                {requestStatus === "error" && <p className={styles.errorText}>{t("changeRequestError")}</p>}
              </form>
            )}

            {/* Datos editables por el propio jugador */}
            <form className={styles.editForm} onSubmit={handleSave}>
              <label className={styles.field}>
                <span className={styles.label}>{t("aliasLabel")}</span>
                <div className={styles.aliasRow}>
                  <input
                    type="text"
                    maxLength={20}
                    value={alias}
                    onChange={(e) => handleAliasChange(e.target.value)}
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.validateButton}
                    onClick={handleValidateAlias}
                    disabled={aliasStatus === "checking" || alias.trim().length < 3}
                  >
                    {aliasStatus === "checking" ? t("validating") : t("validateCta")}
                  </button>
                </div>
              </label>
              {aliasStatus === "available" && <p className={styles.successText}>✓ {t("aliasAvailable")}</p>}
              {aliasStatus === "invalid" && <p className={styles.errorText}>{t("aliasInvalid")}</p>}
              {aliasStatus === "taken" && (
                <p className={styles.errorText}>
                  {suggestion ? t("aliasTaken", { suggestion }) : t("aliasInvalid")}
                  {suggestion && (
                    <button type="button" className={styles.linkButton} onClick={handleUseSuggestion}>
                      {t("useSuggestion")}
                    </button>
                  )}
                </p>
              )}

              <label className={styles.field}>
                <span className={styles.label}>{t("phoneLabel")}</span>
                <input
                  type="tel"
                  maxLength={20}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t("recoveryEmailLabel")}</span>
                <input
                  type="email"
                  maxLength={120}
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className={styles.input}
                />
                <span className={styles.hint}>{t("recoveryEmailHint")}</span>
              </label>

              <button type="submit" className={styles.submitButton} disabled={!canSave || saveStatus === "saving"}>
                {saveStatus === "saving" ? t("saving") : t("saveButton")}
              </button>
              {saveStatus === "saved" && <p className={styles.successText}>{t("saved")}</p>}
              {saveStatus === "error" && <p className={styles.errorText}>{saveError}</p>}
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
