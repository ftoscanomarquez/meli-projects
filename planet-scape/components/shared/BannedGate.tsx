"use client";

import { useTranslations } from "next-intl";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { signOutAction } from "@/lib/actions/auth";
import styles from "./BannedGate.module.css";

/**
 * Bloqueo de pantalla completa para cuentas inhabilitadas — ver AGENTS.md
 * §6.6 (sistema de denuncias/amonestaciones: 3ª amonestación aprobada por
 * un admin = cuenta inhabilitada). A diferencia de `ProfileOnboarding.tsx`,
 * ESTE overlay no tiene botón de cerrar — no es negociable ni se puede
 * posponer, ya que la cuenta fue inhabilitada por una decisión humana del
 * admin tras revisar denuncias reales. La única acción disponible es cerrar
 * sesión.
 */
export function BannedGate() {
  const t = useTranslations("Banned");
  const { session, locale } = useGlobalContext();

  if (!session || !session.banned) return null;

  const handleSignOut = async () => {
    await signOutAction();
    // Navegación dura a propósito — mismo patrón que AuthStatus.tsx (ver
    // lib/actions/auth.ts): un `redirect()` del propio Server Action deja al
    // cliente sirviendo la sesión anterior desde el Router Cache de Next.js.
    window.location.href = `/${locale}`;
  };

  return (
    <div className={styles.overlay} role="alertdialog" aria-modal="true">
      <div className={styles.card}>
        <h2 className={styles.title}>{t("title")}</h2>
        <p className={styles.body}>{t("body")}</p>
        <button type="button" className={styles.signOutButton} onClick={handleSignOut}>
          {t("signOutCta")}
        </button>
      </div>
    </div>
  );
}
