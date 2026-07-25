import { getTranslations } from "next-intl/server";
import { getTopRoomLeaderboard } from "@/lib/roomLeaderboard";
import { Mercury } from "@/components/characters/Mercury";
import { Venus } from "@/components/characters/Venus";
import { Earth } from "@/components/characters/Earth";
import { Mars } from "@/components/characters/Mars";
import { Jupiter } from "@/components/characters/Jupiter";
import { Saturn } from "@/components/characters/Saturn";
import { Neptune } from "@/components/characters/Neptune";
import type { AppLocale } from "@/i18n/routing";
import styles from "./LeaderboardWidget.module.css";
import roomStyles from "./RoomLeaderboardWidget.module.css";

const PLANET_ICONS: Record<string, typeof Mercury> = {
  mercury: Mercury,
  venus: Venus,
  earth: Earth,
  mars: Mars,
  jupiter: Jupiter,
  saturn: Saturn,
  neptune: Neptune,
};

/**
 * Top 10 de salas/equipos (2026-07-23, ampliado de 5 a 10 el 2026-07-24 —
 * pedido explícito del usuario: "el top en equipos que tambien sea de 10" —
 * para quedar parejo con el individual, ver AGENTS.md §8.2). Reutiliza los
 * tokens visuales de `LeaderboardWidget` (individual) para la tarjeta/lista/
 * fecha; la fila de participantes es propia (`roomStyles`) porque muestra
 * varios jugadores en vez de uno solo — pedido explícito del usuario: "de
 * nombre debe de salir el alias del lider que creo la sala en resaltado y
 * el resto de alias de los demas participantes pero solo resalta el del
 * lider".
 */
export async function RoomLeaderboardWidget({ locale }: { locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "RoomLeaderboard" });
  const entries = await getTopRoomLeaderboard(10);
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  if (entries.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{t("title")}</h2>
      <ol className={styles.list}>
        {entries.map((entry, index) => (
          <li key={entry.roomId} className={roomStyles.row}>
            <span className={styles.rank}>{index + 1}</span>
            <span className={roomStyles.participants}>
              {entry.participants.map((p, i) => {
                const Icon = PLANET_ICONS[p.planet];
                return (
                  <span key={i} className={roomStyles.participant} data-leader={p.isLeader}>
                    {Icon && <Icon size={24} />}
                    <span className={roomStyles.participantName}>{p.displayName}</span>
                  </span>
                );
              })}
            </span>
            <span className={styles.metaGroup}>
              <span className={styles.meta}>{t("levelLabel", { level: entry.level })}</span>
              {entry.achievedAt && <span className={styles.date}>{dateFormatter.format(new Date(entry.achievedAt))}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
