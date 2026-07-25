"use client";

import { useTranslations } from "next-intl";
import type { PlanetKey } from "@/engine/characterSvg";
import styles from "./PlanetInfoModal.module.css";

type PlanetInfoData = {
  position: string;
  orbitalPeriod: string;
  funFacts: string[];
  passiveName?: string;
  passiveDescription?: string;
  activeName?: string;
  activeDescription?: string;
};

// Alcance real de cada habilidad — pedido explícito del usuario (2026-07-23):
// "seccion acerca del juego de sus habilidades pasivas y activas, explicando
// si son individuales o ayudan en equipo". Ver AGENTS.md §5/§8.2 — refleja
// exactamente lo implementado en engine/abilities/*.ts y `mergeAllyAid()`/
// `tryShieldNearestAlly()`/`teamPulsarBoosts`/`teamStormActive` en
// GameEngine.ts, no una aspiración.
const ABILITY_SCOPE: Record<PlanetKey, { passive?: "individual" | "team"; active?: "individual" | "team" }> = {
  mercury: { passive: "individual", active: "team" },
  // Venus (destruye asteroides pequeños en polvo, sin daño) y Tierra
  // (inmune a llamaradas amarillas + aurora boreal) ganaron pasivas nuevas
  // el 2026-07-24 (ver AGENTS.md §2.6) — faltaban aquí, bug real reportado
  // por el usuario: "no veo todas las habilidades pasivas... definimos
  // habilidades pasivas a marte, venus y tierra y no las veo especificadas
  // ahi" (Marte de hecho nunca tuvo pasiva, solo activa — se revisó
  // engine/abilities/marsAbility.ts para confirmarlo). Ambas son
  // individuales: se revisan solo contra `this.ability` en
  // GameEngine.ts#checkCollisions(), nunca vía `allyAid` como sí pasa con
  // las activas de estos mismos planetas.
  venus: { passive: "individual", active: "team" },
  earth: { passive: "individual", active: "team" },
  mars: { active: "team" },
  jupiter: { passive: "individual", active: "team" },
  saturn: { passive: "team", active: "team" },
  neptune: { passive: "individual", active: "team" },
};

/**
 * Sección informativa por planeta — pedido explícito del usuario
 * (2026-07-23): "una seccion informativa por planeta en donde especifique
 * cada habilidad activa y pasiva... datos reales, como nombre, numero en el
 * sistema solar... cuanto tarda en girar al sol... comparado con la
 * Tierra... datos curiosos verdaderos... y seccion acerca del juego de sus
 * habilidades... explicando si son individuales o ayudan en equipo". Todo
 * el contenido (datos reales y de juego) vive en messages/*.json
 * (namespace "PlanetInfo") — ver AGENTS.md §12 regla 4, nunca texto fijo.
 */
export function PlanetInfoModal({ planet, onClose }: { planet: PlanetKey; onClose: () => void }) {
  const t = useTranslations("PlanetInfo");
  const tPlanets = useTranslations("Planets");
  const info = t.raw(planet) as PlanetInfoData;
  const scope = ABILITY_SCOPE[planet];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeButton} aria-label={t("closeAria")} onClick={onClose}>
          ✕
        </button>
        <h3 className={styles.title}>{tPlanets(planet)}</h3>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{t("realDataTitle")}</h4>
          <div className={styles.factRow}>
            <span className={styles.factLabel}>{t("positionLabel")}</span>
            <span className={styles.factValue}>{info.position}</span>
          </div>
          <div className={styles.factRow}>
            <span className={styles.factLabel}>{t("orbitalPeriodLabel")}</span>
            <span className={styles.factValue}>{info.orbitalPeriod}</span>
          </div>
          <h5 className={styles.subTitle}>{t("funFactsTitle")}</h5>
          <ul className={styles.factList}>
            {info.funFacts.map((fact, i) => (
              <li key={i}>{fact}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{t("abilitiesTitle")}</h4>
          {info.passiveName && (
            <div className={styles.abilityCard}>
              <div className={styles.abilityHeader}>
                <span className={styles.abilityTag}>{t("passiveLabel")}</span>
                <span className={styles.abilityName}>{info.passiveName}</span>
              </div>
              <p className={styles.abilityDescription}>{info.passiveDescription}</p>
              <span className={styles.scopeBadge} data-scope={scope.passive}>
                {scope.passive === "team" ? t("scopeTeam") : t("scopeIndividual")}
              </span>
            </div>
          )}
          {info.activeName && (
            <div className={styles.abilityCard}>
              <div className={styles.abilityHeader}>
                <span className={styles.abilityTag}>{t("activeLabel")}</span>
                <span className={styles.abilityName}>{info.activeName}</span>
              </div>
              <p className={styles.abilityDescription}>{info.activeDescription}</p>
              <span className={styles.scopeBadge} data-scope={scope.active}>
                {scope.active === "team" ? t("scopeTeam") : t("scopeIndividual")}
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
