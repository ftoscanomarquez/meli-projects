import { getTranslations } from "next-intl/server";
import { getTopLeaderboard } from "@/lib/leaderboard";
import { Mercury } from "@/components/characters/Mercury";
import { Venus } from "@/components/characters/Venus";
import { Earth } from "@/components/characters/Earth";
import { Mars } from "@/components/characters/Mars";
import { Jupiter } from "@/components/characters/Jupiter";
import { Saturn } from "@/components/characters/Saturn";
import { Neptune } from "@/components/characters/Neptune";
import type { AppLocale } from "@/i18n/routing";
import styles from "./LeaderboardWidget.module.css";

// Ícono de planeta por entrada — pedido explícito del usuario (2026-07-22):
// "pon una imagen para saber con qué planeta logró ese ranking". Estos
// componentes SVG no usan hooks (ver components/characters/*.tsx), así que
// se pueden renderizar aquí mismo (Server Component) sin problema.
const PLANET_ICONS: Record<string, typeof Mercury> = {
  mercury: Mercury,
  venus: Venus,
  earth: Earth,
  mars: Mars,
  jupiter: Jupiter,
  saturn: Saturn,
  neptune: Neptune,
};

/** Ver AGENTS.md §6 (Fase 6) — top 10 global, Server Component directo a Mongo. */
export async function LeaderboardWidget({ locale }: { locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "Leaderboard" });
  const entries = await getTopLeaderboard(10);
  // Fecha del récord — pedido explícito del usuario (2026-07-23): "debe
  // salir en ambos ranking la fecha en que se alcanzo dicho record".
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{t("title")}</h2>
      {entries.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ol className={styles.list}>
          {entries.map((entry, index) => {
            const Icon = entry.planet ? PLANET_ICONS[entry.planet] : undefined;
            return (
              <li key={`${entry.displayName}-${index}`} className={styles.row}>
                <span className={styles.rank}>{index + 1}</span>
                {Icon && (
                  <span className={styles.planetIcon}>
                    <Icon size={26} />
                  </span>
                )}
                <span className={styles.name}>{entry.displayName}</span>
                <span className={styles.metaGroup}>
                  <span className={styles.meta}>{t("levelLabel", { level: entry.levelReached })}</span>
                  {entry.achievedAt && <span className={styles.date}>{dateFormatter.format(new Date(entry.achievedAt))}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
