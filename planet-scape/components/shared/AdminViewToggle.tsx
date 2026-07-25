"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setAdminViewRole } from "@/lib/actions/adminView";
import styles from "./AdminViewToggle.module.css";

/**
 * Selector "ver como jugador / ver como admin" — pedido explícito del
 * usuario (2026-07-22), ver lib/actions/adminView.ts. Solo se muestra si
 * `players.role === "admin"` de verdad (prop `visible`); el estado actual
 * se lee de la cookie que ya puso el servidor en el HTML (atributo
 * `data-active`, ver AdminViewToggle.module.css) para no depender de un
 * fetch adicional solo para saber en qué modo está.
 */
export function AdminViewToggle({ initialRole }: { initialRole: "admin" | "player" }) {
  const t = useTranslations("Auth");
  const [role, setRole] = useState(initialRole);
  const [pending, setPending] = useState(false);

  const handleChange = async (next: "admin" | "player") => {
    if (next === role || pending) return;
    setPending(true);
    setRole(next);
    await setAdminViewRole(next);
    // Navegación dura: `/admin` es un Server Component que lee la cookie en
    // cada request — un simple `setState` de React no vuelve a evaluarlo.
    window.location.reload();
  };

  return (
    <div className={styles.toggle} role="group" aria-label={t("adminViewLabel")}>
      <button
        type="button"
        className={styles.option}
        data-active={role === "player"}
        onClick={() => handleChange("player")}
        disabled={pending}
      >
        {t("viewAsPlayer")}
      </button>
      <button
        type="button"
        className={styles.option}
        data-active={role === "admin"}
        onClick={() => handleChange("admin")}
        disabled={pending}
      >
        {t("viewAsAdmin")}
      </button>
    </div>
  );
}
