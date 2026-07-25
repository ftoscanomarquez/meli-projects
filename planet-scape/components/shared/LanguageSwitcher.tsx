"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import styles from "./LanguageSwitcher.module.css";

/**
 * Selector de idioma (es/en) — faltaba en la UI, pedido real del usuario
 * (2026-07-22). Solo 2 locales, así que un botón simple muestra el OTRO
 * idioma disponible y cambia a él manteniendo la ruta actual (next-intl
 * `router.replace(pathname, {locale})`, sin perder de vista en qué pantalla
 * estabas). Ver AGENTS.md §12 regla 4 — el propio nombre del idioma no se
 * traduce (es intencional: "EN"/"ES" son etiquetas universales, no texto
 * de UI localizable).
 */
export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useCurrentLocale();
  const otherLocale = routing.locales.find((l) => l !== currentLocale) ?? routing.locales[0];

  return (
    <button
      type="button"
      className={styles.button}
      aria-label={`Switch language to ${otherLocale === "es" ? "Español" : "English"}`}
      onClick={() => router.replace(pathname, { locale: otherLocale })}
    >
      {otherLocale.toUpperCase()}
    </button>
  );
}

// next-intl no expone el locale actual directamente desde useRouter/usePathname
// (usePathname ya devuelve la ruta SIN el prefijo de locale) — se lee del
// atributo `lang` del documento, que `app/[locale]/layout.tsx` ya fija.
function useCurrentLocale(): AppLocale {
  if (typeof document === "undefined") return routing.defaultLocale;
  const lang = document.documentElement.lang;
  return (routing.locales as readonly string[]).includes(lang) ? (lang as AppLocale) : routing.defaultLocale;
}
