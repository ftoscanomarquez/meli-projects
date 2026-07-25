"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { GameConfig } from "@/lib/schemas/gameConfig";
import styles from "./DonationPrompt.module.css";

/**
 * Mensaje de fin de partida — ver AGENTS.md §10 y PROMPT.md. Texto de Meli/
 * Francisco localizable vía i18n (nunca hardcoded, ver AGENTS.md §12 regla 4).
 * Min/paso/máximo/enlace de WhatsApp vienen de `game_config` (Fase 8,
 * editable por el admin sin redeploy) — ver AGENTS.md §9.
 */
export function DonationPrompt({ donation, whatsappLink }: { donation: GameConfig["donation"]; whatsappLink?: string }) {
  const t = useTranslations("Donation");
  const [amountCents, setAmountCents] = useState(donation.minAmountCents);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const handleDonate = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/donations/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>💛 {t("title")}</h3>

      {/* El valor de la aportación y el botón van PRIMERO, antes de los
          mensajes — pedido explícito del usuario (2026-07-24): "que la info
          del valor de tu aportacion y el boton esten arriba, es decir sea
          lo primero y abajo ya el comentario de Meli despues Francisco y
          despues el Whatsapp". */}
      <div className={styles.sliderRow}>
        <span className={styles.sliderLabel}>{t("sliderLabel")}</span>
        <span className={styles.amount}>${(amountCents / 100).toFixed(0)} MXN</span>
        <input
          type="range"
          className={styles.slider}
          min={donation.minAmountCents}
          max={donation.maxAmountCents}
          step={donation.stepCents}
          value={amountCents}
          onChange={(e) => setAmountCents(Number(e.target.value))}
        />
      </div>

      <button type="button" className={styles.donateButton} onClick={handleDonate} disabled={status === "loading"}>
        {status === "loading" ? t("processing") : t("donateButton", { amount: (amountCents / 100).toFixed(0) })}
      </button>

      {status === "error" && <p className={styles.errorText}>{t("error")}</p>}

      {/* Cada mensaje empieza con el NOMBRE de quien habla, luego su párrafo
          — pedido explícito del usuario (2026-07-24): "ese parrafo primero
          debe de decir: Meli y luego su parrafo... despues debe decir dolo
          Francisco y despues su parrafo" (antes el nombre iba al final,
          como firma). */}
      <div className={styles.speaker}>
        <span className={styles.speakerName} data-voice="meli">
          {t("meliName")}
        </span>
        <p className={styles.message}>{t("meliMessage")}</p>
      </div>
      <div className={styles.speaker}>
        <span className={styles.speakerName} data-voice="francisco">
          {t("franciscoName")}
        </span>
        <p className={styles.message}>{t("franciscoMessage")}</p>
      </div>

      {whatsappLink && (
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className={styles.whatsappLink}>
          {/* Símbolo de WhatsApp — pedido explícito del usuario (2026-07-24):
              "el link de whats app, por lo menos ponle el simbolo de
              whatsapp". Ícono dibujado a mano (sin archivo de imagen, ver
              AGENTS.md §4: personajes/íconos 100% procedurales). */}
          <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true" className={styles.whatsappIcon}>
            <circle cx="16" cy="16" r="16" fill="#25D366" />
            <path
              fill="#fff"
              d="M16 7.5c-4.7 0-8.5 3.8-8.5 8.5 0 1.5.4 2.9 1.1 4.2L7.5 24.5l4.5-1.1c1.2.6 2.6 1 4 1 4.7 0 8.5-3.8 8.5-8.5S20.7 7.5 16 7.5Zm4.9 12.1c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .5.4.2.5.7 1.7.7 1.9.1.1.1.3 0 .4-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.7-.8c.2-.3.4-.2.7-.1l1.7.8c.2.1.4.2.5.3.1.2.1.9-.1 1.6Z"
            />
          </svg>
          {t("whatsappCta")}
        </a>
      )}
    </div>
  );
}
