"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { GameConfig } from "@/lib/schemas/gameConfig";
import { DonationPrompt } from "@/components/game/DonationPrompt";
import styles from "./DonationButton.module.css";

/**
 * Botón de donación SIEMPRE disponible — pedido explícito del usuario
 * (2026-07-22): antes el panel de aportación voluntaria (`DonationPrompt`)
 * solo aparecía en la pantalla de fin de partida ("cuando te matan"). Este
 * botón flotante abre el mismo panel (mismo mensaje de Meli/Francisco,
 * mismo slider, mismo checkout de Stripe) en cualquier momento — durante
 * una partida en curso (`GameHud.tsx`) y desde la landing (`page.tsx`,
 * antes incluso de jugar) — ver AGENTS.md §10.
 */
export function DonationButton({
  donation,
  whatsappLink,
  floating = false,
}: {
  donation: GameConfig["donation"];
  whatsappLink?: string;
  /** true en la landing (botón flotante independiente); false dentro del HUD del juego (vive en la barra ya existente). */
  floating?: boolean;
}) {
  const t = useTranslations("Donation");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={floating ? styles.floatingButton : styles.inlineButton}
        aria-label={t("title")}
        onClick={() => setOpen(true)}
      >
        {floating ? `❤️ ${t("title")}` : "❤️"}
      </button>

      {open && (
        <div className={styles.overlay} role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.closeButton} aria-label={t("close")} onClick={() => setOpen(false)}>
              ✕
            </button>
            <DonationPrompt donation={donation} whatsappLink={whatsappLink} />
          </div>
        </div>
      )}
    </>
  );
}
