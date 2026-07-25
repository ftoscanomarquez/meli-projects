"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { requestMagicLink, signOutAction } from "@/lib/actions/auth";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { AdminViewToggle } from "@/components/shared/AdminViewToggle";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { MyProfileModal } from "@/components/profile/MyProfileModal";
import { AccountRecoveryModal } from "./AccountRecoveryModal";
import type { AppLocale } from "@/i18n/routing";
import styles from "./AuthStatus.module.css";

// Fase 1: funcional. Fase 2 solo le da estilo (widget flotante) — el rediseño
// completo de las pantallas de auth dedicadas queda para cuando se necesiten
// páginas propias en vez del widget inline (ver AGENTS.md §6).
export function AuthStatus() {
  const { session, locale, adminViewRole } = useGlobalContext();
  const t = useTranslations("Auth");
  const [entering, setEntering] = useState(false);
  // Paso de código de 6 dígitos (2026-07-22, pedido explícito del usuario:
  // en vez de tener que compartir/abrir el Magic Link en otro dispositivo,
  // basta con ver el correo en Mailpit y teclear el código aquí — ver
  // lib/auth.ts y AGENTS.md §6.3).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resent, setResent] = useState(false);
  // Recuperación de cuenta (alias + fecha de nacimiento -> WhatsApp) — ver
  // AGENTS.md §6.7 y AccountRecoveryModal.tsx.
  const [showRecovery, setShowRecovery] = useState(false);
  // Autoservicio de perfil (teléfono/correo de recuperación/alias) — ver
  // AGENTS.md §6.8 y MyProfileModal.tsx.
  const [showProfile, setShowProfile] = useState(false);

  const handleRequestMagicLink = async (formData: FormData) => {
    setEntering(true);
    const email = String(formData.get("email") ?? "");
    // Solo retorna `devAutoLoginUrl` en modo DEV_AUTO_LOGIN (ver
    // lib/actions/auth.ts) — en modo normal siempre retorna `codeSent`.
    const result = await requestMagicLink(locale as AppLocale, formData);
    if ("devAutoLoginUrl" in result) {
      window.location.href = result.devAutoLoginUrl;
      return;
    }
    setPendingEmail(email);
    setEntering(false);
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setEntering(true);
    const formData = new FormData();
    formData.set("email", pendingEmail);
    await requestMagicLink(locale as AppLocale, formData);
    setEntering(false);
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  };

  const handleVerifyCode = (e: FormEvent) => {
    e.preventDefault();
    if (!pendingEmail || code.trim().length !== 6) return;
    setVerifying(true);
    // El código de 6 dígitos ES el token que Auth.js espera en su endpoint
    // de callback de siempre (mismo mecanismo que el enlace del correo, solo
    // tecleado a mano en vez de un clic) — navegación dura a propósito, ver
    // el mismo patrón en DEV_AUTO_LOGIN (lib/dev/mailpitAutoLogin.ts).
    // `callbackUrl` ABSOLUTA usando `window.location.origin` — pedido
    // explícito del usuario (2026-07-24) tras ver que el login por código
    // seguía redirigiendo a localhost en el celular: "no deberian ser datos
    // fijos estas redirecciones... cuando sale la pantalla principal la
    // primera vez guarda el host... para que cualquier redireccion... sepa
    // que debe llamar a su propio host". El navegador YA sabe su origen
    // real (localhost en PC, la IP de LAN en el celular) sin necesitar
    // adivinarlo del lado del servidor — antes se mandaba una ruta relativa
    // (`/${locale}`), y el callback de Auth.js (`lib/auth.ts`) la resolvía
    // con su propio `baseUrl` interno, que en esta misma request puede
    // resolver mal (ver el comentario largo en `callbacks.redirect`).
    const callbackUrl = `${window.location.origin}/${locale}`;
    const verifyUrl = `/api/auth/callback/nodemailer?token=${encodeURIComponent(code.trim())}&email=${encodeURIComponent(pendingEmail)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    window.location.href = verifyUrl;
  };

  const handleSignOut = async () => {
    await signOutAction();
    // Navegación dura a propósito — ver lib/actions/auth.ts. Un `redirect()`
    // del propio Server Action deja al cliente sirviendo la sesión anterior
    // desde el Router Cache de Next.js.
    window.location.href = `/${locale}`;
  };

  if (session) {
    return (
      <div className={styles.widget}>
        <span className={styles.sessionInfo}>
          {session.displayName} · <span className={styles.starCount}>{session.stars} ⭐</span>
        </span>
        {session.role === "admin" && <AdminViewToggle initialRole={adminViewRole} />}
        <NotificationBell />
        {/* En móvil se saca del flujo y se coloca fijo debajo del selector
            de idioma — pedido explícito del usuario (2026-07-24): "El boton
            de perfil solo en mobile ponlo abajo del boton de idioma". En
            escritorio se queda inline aquí mismo, sin cambios. */}
        <div className={styles.profileButtonWrapper}>
          <button type="button" className={styles.profileButton} aria-label={t("myProfile")} onClick={() => setShowProfile(true)}>
            👤
          </button>
        </div>
        <button type="button" onClick={handleSignOut} className={styles.signOutButton}>
          {t("signOut")}
        </button>
        <div className={styles.languageSwitcherWrapper}>
          <LanguageSwitcher />
        </div>
        {showProfile && <MyProfileModal onClose={() => setShowProfile(false)} />}
      </div>
    );
  }

  if (pendingEmail) {
    return (
      <div className={styles.widget}>
        <form onSubmit={handleVerifyCode} className={styles.form}>
          <div className={styles.codeStepText}>
            {t("codeStepHint", { email: pendingEmail })}
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder={t("codePlaceholder")}
            aria-label={t("codeLabel")}
            required
            autoFocus
            disabled={verifying}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={styles.codeInput}
          />
          <button type="submit" className={styles.submitButton} disabled={verifying || code.length !== 6}>
            {verifying ? t("entering") : t("verifyCta")}
          </button>
          <div className={styles.codeStepActions}>
            <button type="button" onClick={handleResend} disabled={entering} className={styles.linkButton}>
              {resent ? t("codeResent") : t("resendCode")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingEmail(null);
                setCode("");
              }}
              className={styles.linkButton}
            >
              {t("changeEmail")}
            </button>
          </div>
        </form>
        <div className={styles.languageSwitcherWrapper}>
          <LanguageSwitcher />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.widget}>
      <form action={handleRequestMagicLink} className={styles.form}>
        <input
          type="email"
          name="email"
          placeholder={t("emailPlaceholder")}
          aria-label={t("emailLabel")}
          required
          disabled={entering}
          className={styles.emailInput}
        />
        <button type="submit" className={styles.submitButton} disabled={entering}>
          {entering ? t("entering") : t("submitCta")}
        </button>
        <button type="button" className={styles.linkButton} onClick={() => setShowRecovery(true)}>
          {t("forgotEmail")}
        </button>
      </form>
      <div className={styles.languageSwitcherWrapper}>
        <LanguageSwitcher />
      </div>
      {showRecovery && <AccountRecoveryModal onClose={() => setShowRecovery(false)} />}
    </div>
  );
}
