"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import styles from "./ProfileOnboarding.module.css";

/**
 * Registro obligatorio de nombre/apellido/alias al iniciar sesión por
 * primera vez — pedido explícito del usuario (2026-07-22): "cuando eligen
 * un mismo planeta no hay forma de distinguir quién es quién" — el alias es
 * lo que se muestra encima del sprite en multijugador (ver GameEngine.ts).
 * Gateado por `session.profileCompleted` (ver AGENTS.md §6.4) — se muestra
 * en cualquier página hasta completarse. Los tres campos siguen siendo
 * obligatorios para ENVIAR el formulario (la validación no cambia), pero
 * tiene un botón de cerrar (`dismissed`) para no dejar al jugador atrapado
 * sin poder navegar — pedido explícito del usuario (2026-07-22): "si quieres
 * registrarte sin poner nada no te deja [salir]". Cerrar solo oculta la
 * pantalla para la sesión actual del navegador (estado local, no se guarda
 * en el servidor) — vuelve a aparecer en la siguiente carga de página,
 * porque `profileCompleted` sigue en `false` hasta que de verdad se registre.
 *
 * Campos de edad/Términos y Condiciones (2026-07-22, ver AGENTS.md §6.5):
 * agregados a pedido explícito del usuario para poder gatear el chat en
 * vivo de multijugador a solo mayores de edad. `termsAndConditions` llega
 * como prop desde el Server Component raíz (app/[locale]/layout.tsx, ya
 * leído de Mongo ahí) en vez de pedirse por su cuenta desde este Client
 * Component — mismo patrón que `initialSession`.
 */
export function ProfileOnboarding({ termsAndConditions }: { termsAndConditions: string }) {
  const t = useTranslations("Onboarding");
  const { session, setSession } = useGlobalContext();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [alias, setAlias] = useState("");
  const [birthDate, setBirthDate] = useState("");
  // Opcionales — pedido explícito del usuario (2026-07-22, ver AGENTS.md
  // §6.7): solo se usan para la recuperación de cuenta (alias + fecha de
  // nacimiento -> WhatsApp con el correo registrado). Nunca bloquean el envío
  // del formulario, a diferencia de nombre/apellido/alias/fecha/términos.
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [aliasStatus, setAliasStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (!session || session.profileCompleted || dismissed) return null;

  const handleAliasChange = (value: string) => {
    setAlias(value);
    setAliasStatus("idle");
    setSuggestion(null);
  };

  const handleValidateAlias = async () => {
    if (alias.trim().length < 3) {
      setAliasStatus("invalid");
      return;
    }
    setAliasStatus("checking");
    try {
      const res = await fetch(`/api/profile/check-alias?alias=${encodeURIComponent(alias.trim())}`);
      if (!res.ok) {
        setAliasStatus("invalid");
        return;
      }
      const body = await res.json();
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
    // El servidor acaba de confirmar que esta variante está libre — se
    // acepta como válida sin obligar a otro round-trip; el endpoint de
    // guardado igual protege contra una carrera real (índice único +
    // manejo de E11000, ver app/api/profile/complete/route.ts).
    setAlias(suggestion);
    setAliasStatus("available");
    setSuggestion(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || aliasStatus !== "available" || !birthDate || !acceptedTerms) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          alias: alias.trim(),
          birthDate,
          acceptedTerms,
          phone: phone.trim(),
          nationality: nationality.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.code === "ALIAS_TAKEN") {
          setAliasStatus("taken");
          setSubmitError(null);
        } else {
          setSubmitError(body.error ?? t("submitError"));
        }
        return;
      }
      setSession({
        ...session,
        displayName: body.displayName,
        firstName: body.firstName,
        lastName: body.lastName,
        profileCompleted: true,
        isAdult: body.isAdult ?? false,
      });
    } catch {
      setSubmitError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  // Tope superior del <input type="date"> = hoy, para que el navegador
  // mismo impida elegir una fecha de nacimiento futura (validación real
  // sigue viviendo en el servidor, ver lib/schemas/player.ts#BirthDateSchema).
  const todayIso = new Date().toISOString().slice(0, 10);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    aliasStatus === "available" &&
    !!birthDate &&
    acceptedTerms &&
    !submitting;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <form className={styles.card} onSubmit={handleSubmit}>
        <button
          type="button"
          className={styles.closeButton}
          aria-label={t("closeButton")}
          onClick={() => setDismissed(true)}
        >
          ✕
        </button>
        <h2 className={styles.title}>{t("title")}</h2>
        <p className={styles.hint}>{t("hint")}</p>

        <label className={styles.field}>
          <span className={styles.label}>{t("firstNameLabel")}</span>
          <input
            type="text"
            required
            maxLength={50}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("lastNameLabel")}</span>
          <input
            type="text"
            required
            maxLength={50}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("aliasLabel")}</span>
          <div className={styles.aliasRow}>
            <input
              type="text"
              required
              maxLength={20}
              placeholder={t("aliasPlaceholder")}
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

        {aliasStatus === "available" && <p className={styles.aliasOk}>✓ {t("aliasAvailable")}</p>}
        {aliasStatus === "invalid" && <p className={styles.aliasError}>{t("aliasInvalid")}</p>}
        {aliasStatus === "taken" && (
          <p className={styles.aliasError}>
            {suggestion ? t("aliasTaken", { suggestion }) : t("aliasInvalid")}
            {suggestion && (
              <button type="button" className={styles.suggestionButton} onClick={handleUseSuggestion}>
                {t("useSuggestion")}
              </button>
            )}
          </p>
        )}

        <label className={styles.field}>
          <span className={styles.label}>{t("phoneLabel")} <span className={styles.optionalTag}>{t("optionalTag")}</span></span>
          <input
            type="tel"
            maxLength={20}
            placeholder={t("phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={styles.input}
          />
          <span className={styles.hint}>{t("phoneHint")}</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("nationalityLabel")} <span className={styles.optionalTag}>{t("optionalTag")}</span></span>
          <input
            type="text"
            maxLength={60}
            placeholder={t("nationalityPlaceholder")}
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
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
          <span className={styles.hint}>{t("birthDateHint")}</span>
        </label>

        <label className={styles.termsRow}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <span>{t("termsCheckboxLabel")}</span>
        </label>
        <button type="button" className={styles.termsLink} onClick={() => setShowTerms(true)}>
          {t("termsViewCta")}
        </button>

        <button type="submit" className={styles.submitButton} disabled={!canSubmit}>
          {submitting ? t("submitting") : t("submitCta")}
        </button>
        {submitError && <p className={styles.aliasError}>{submitError}</p>}
      </form>

      {/* Modal de solo lectura de los Términos y Condiciones completos —
          separado del formulario para no perder lo ya capturado al abrirlo. */}
      {showTerms && (
        <div className={styles.termsOverlay} role="dialog" aria-modal="true">
          <div className={styles.termsCard}>
            <h3 className={styles.title}>{t("termsModalTitle")}</h3>
            <div className={styles.termsBody}>{termsAndConditions}</div>
            <button type="button" className={styles.submitButton} onClick={() => setShowTerms(false)}>
              {t("termsModalClose")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
