"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./SpaceFactBubble.module.css";
import type { AppLocale } from "@/i18n/routing";

const ROTATE_MS = 9000;

/**
 * Rotación en vivo del dato curioso — pedido explícito del usuario
 * (2026-07-24): "todos esos mensaje tardan mucho en cambiar". Antes
 * `SpaceFactBubble` solo mostraba un dato fijo resuelto server-side (una vez
 * por navegación completa, ver proxy.ts) — este componente cliente lo toma
 * como primer valor y luego pide uno nuevo cada `ROTATE_MS` a
 * `/api/space-facts/random`, que reutiliza la misma cookie de "no repetir"
 * (ver AGENTS.md §1.1). Reanima con la misma animación `fadeSlide` de
 * SpaceFactBubble.module.css en cada cambio (retriggered por el `key`).
 */
export function SpaceFactRotator({
  initialText,
  locale,
}: {
  initialText: string | null;
  locale: AppLocale;
}) {
  const t = useTranslations("Landing");
  const [text, setText] = useState(initialText);
  const [tick, setTick] = useState(0);
  const rotating = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (rotating.current) return;
      rotating.current = true;
      try {
        const res = await fetch(`/api/space-facts/random?locale=${locale}`);
        if (res.ok) {
          const body = (await res.json()) as { text: string | null };
          if (body.text) {
            setText(body.text);
            setTick((v) => v + 1);
          }
        }
      } catch {
        // Silencioso a propósito: si falla, el dato actual se queda visible
        // hasta el siguiente intento — no es un error que el jugador deba ver.
      } finally {
        rotating.current = false;
      }
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [locale]);

  return (
    <p className={styles.factText} key={tick}>
      {text ?? t("factLoading")}
    </p>
  );
}
