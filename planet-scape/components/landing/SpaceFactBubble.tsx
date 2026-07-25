import { getTranslations } from "next-intl/server";
import { Sun } from "@/components/characters/Sun";
import { SpaceFactRotator } from "./SpaceFactRotator";
import styles from "./SpaceFactBubble.module.css";
import type { AppLocale } from "@/i18n/routing";

/**
 * Elemento firma de la landing (ver AGENTS.md §1.1): el Sol narrando el
 * dato curioso del día en una burbuja de cómic. `factText` ya viene resuelto
 * server-side (proxy.ts + lib/spaceFacts.ts) — nunca Math.random() en cliente.
 */
export async function SpaceFactBubble({
  locale,
  factText,
}: {
  locale: AppLocale;
  factText: string | null;
}) {
  const t = await getTranslations({ locale, namespace: "Landing" });

  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>{t("eyebrow")}</p>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.subtitle}>{t("subtitle")}</p>

      <div className={styles.sunRow}>
        <Sun size={140} talking={Boolean(factText)} />
        <div className={styles.bubble}>
          <p className={styles.factEyebrow}>{t("factEyebrow")}</p>
          <SpaceFactRotator initialText={factText} locale={locale} />
        </div>
      </div>
    </section>
  );
}
