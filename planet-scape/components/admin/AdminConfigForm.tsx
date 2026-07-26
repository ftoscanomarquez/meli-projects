"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { GameConfig } from "@/lib/schemas/gameConfig";
import { FormattedNumberInput } from "./FormattedNumberInput";
import styles from "./Admin.module.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type AbilityPlanet = "mercury" | "venus" | "earth" | "mars" | "jupiter" | "saturn" | "neptune";

const ABILITY_PLANETS: AbilityPlanet[] = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "neptune"];

/**
 * Sol amarillo y Sol Rojo comparten el mismo shape de configuración pero ya
 * NO el mismo documento (`game_config.sun`/`redSun`, ver AGENTS.md §5.1) —
 * pedido explícito del usuario (2026-07-22): "aunque inicialmente son las
 * mismas, permite que cada quien tenga su configuración". Un solo
 * componente reutilizado dos veces evita duplicar los 3 campos.
 */
function SunConfigGroup({
  titleKey,
  idPrefix,
  value,
  onChange,
  minLevel,
}: {
  titleKey: string;
  idPrefix: string;
  value: GameConfig["sun"];
  onChange: (next: GameConfig["sun"]) => void;
  // Solo el Sol Rojo lo usa (ver AGENTS.md §5.1) — el amarillo siempre
  // aparece desde el nivel 0, no tiene sentido un umbral editable para él.
  minLevel?: { value: number; onChange: (v: number) => void };
}) {
  const t = useTranslations("Admin");
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{t(titleKey)}</span>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${idPrefix}-min-flares`}>
            {t("minFlaresLabel")}
          </label>
          <FormattedNumberInput
            id={`${idPrefix}-min-flares`}
            min={1}
            value={value.minFlares}
            onChange={(v) => onChange({ ...value, minFlares: v })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${idPrefix}-max-flares`}>
            {t("maxFlaresLabel")}
          </label>
          <FormattedNumberInput
            id={`${idPrefix}-max-flares`}
            min={1}
            value={value.maxFlares}
            onChange={(v) => onChange({ ...value, maxFlares: v })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${idPrefix}-frequency`}>
            {t("spawnFrequencyLabel")}
          </label>
          <FormattedNumberInput
            id={`${idPrefix}-frequency`}
            min={100}
            value={value.spawnFrequencyMs}
            onChange={(v) => onChange({ ...value, spawnFrequencyMs: v })}
          />
        </div>
        {minLevel && (
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${idPrefix}-min-level`}>
              {t("minLevelLabel")}
            </label>
            {/* Sin piso mínimo — pedido explícito del usuario (2026-07-22):
                "quita la restricción... para poder validarlos y ver cómo
                funcionan". Antes no podía bajar de 20. */}
            <FormattedNumberInput id={`${idPrefix}-min-level`} min={0} value={minLevel.value} onChange={minLevel.onChange} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Agujero Negro clásico y Nova — mismo motivo que `SunConfigGroup` de
 * arriba: documentos independientes (`game_config.blackHole`/`novaBlackHole`)
 * que arrancan iguales pero se editan por separado.
 */
function BlackHoleConfigGroup({
  titleKey,
  idPrefix,
  value,
  onChange,
  minLevel,
}: {
  titleKey: string;
  idPrefix: string;
  value: GameConfig["blackHole"];
  onChange: (next: GameConfig["blackHole"]) => void;
  // Solo el Nova lo usa (ver AGENTS.md §5.1) — el clásico siempre aparece
  // desde el nivel 0.
  minLevel?: { value: number; onChange: (v: number) => void };
}) {
  const t = useTranslations("Admin");
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{t(titleKey)}</span>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${idPrefix}-size`}>
            {t("sizeLabel")}
          </label>
          <FormattedNumberInput id={`${idPrefix}-size`} min={1} value={value.size} onChange={(v) => onChange({ ...value, size: v })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${idPrefix}-force`}>
            {t("attractionForceLabel")}
          </label>
          <FormattedNumberInput
            id={`${idPrefix}-force`}
            min={0}
            step={0.1}
            value={value.attractionForce}
            onChange={(v) => onChange({ ...value, attractionForce: v })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${idPrefix}-min-clicks`}>
            {t("minClicksLabel")}
          </label>
          <FormattedNumberInput
            id={`${idPrefix}-min-clicks`}
            min={1}
            value={value.minClicksToDefeat}
            onChange={(v) => onChange({ ...value, minClicksToDefeat: v })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${idPrefix}-max-clicks`}>
            {t("maxClicksLabel")}
          </label>
          <FormattedNumberInput
            id={`${idPrefix}-max-clicks`}
            min={1}
            value={value.maxClicksToDefeat}
            onChange={(v) => onChange({ ...value, maxClicksToDefeat: v })}
          />
        </div>
        {minLevel && (
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${idPrefix}-min-level`}>
              {t("minLevelLabel")}
            </label>
            {/* Sin piso mínimo — pedido explícito del usuario (2026-07-22),
                ver mismo comentario en SunConfigGroup arriba. */}
            <FormattedNumberInput id={`${idPrefix}-min-level`} min={0} value={minLevel.value} onChange={minLevel.onChange} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Quasar (2026-07-24, ver AGENTS.md §5.1) — pedido explícito del usuario:
 * "configurable en admin la intensidad de atracción, nivel en que aparece,
 * etc.". Documento independiente (`game_config.quasar`), mismo patrón que
 * el resto de peligros avanzados de arriba.
 */
function QuasarConfigGroup({ value, onChange }: { value: GameConfig["quasar"]; onChange: (next: GameConfig["quasar"]) => void }) {
  const t = useTranslations("Admin");
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{t("quasarGroupTitle")}</span>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quasar-min-level">
            {t("minLevelLabel")}
          </label>
          <FormattedNumberInput id="quasar-min-level" min={0} value={value.minLevel} onChange={(v) => onChange({ ...value, minLevel: v })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quasar-attraction-radius">
            {t("quasarAttractionRadiusLabel")}
          </label>
          <FormattedNumberInput
            id="quasar-attraction-radius"
            min={1}
            step={0.1}
            value={value.attractionRadiusMultiplier}
            onChange={(v) => onChange({ ...value, attractionRadiusMultiplier: v })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quasar-attraction-intensity">
            {t("quasarAttractionIntensityLabel")}
          </label>
          <FormattedNumberInput
            id="quasar-attraction-intensity"
            min={0.1}
            step={0.1}
            value={value.attractionIntensity}
            onChange={(v) => onChange({ ...value, attractionIntensity: v })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quasar-clicks">
            {t("quasarClicksLabel")}
          </label>
          <FormattedNumberInput
            id="quasar-clicks"
            min={1}
            value={value.clicksToDefeat}
            onChange={(v) => onChange({ ...value, clicksToDefeat: v })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quasar-ray-damage">
            {t("quasarRayDamageLabel")}
          </label>
          <FormattedNumberInput
            id="quasar-ray-damage"
            min={1}
            value={value.rayDamageLives}
            onChange={(v) => onChange({ ...value, rayDamageLives: v })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quasar-size">
            {t("sizeLabel")}
          </label>
          <FormattedNumberInput id="quasar-size" min={1} value={value.size} onChange={(v) => onChange({ ...value, size: v })} />
        </div>
      </div>
    </div>
  );
}

/**
 * Balance del juego editable en runtime (Fase 8) — ver AGENTS.md §9. Un PUT
 * exitoso aquí se refleja en la siguiente partida/lobby sin redeploy, porque
 * `getGameConfig()` (lib/gameConfig.ts) nunca cachea más allá del request.
 * Todos los campos numéricos usan `FormattedNumberInput` (separador de
 * miles) — pedido explícito del usuario (2026-07-22).
 */
export function AdminConfigForm({ initialConfig }: { initialConfig: GameConfig }) {
  const t = useTranslations("Admin");
  const tPlanets = useTranslations("Planets");
  const [config, setConfig] = useState<GameConfig>(initialConfig);
  const [status, setStatus] = useState<SaveStatus>("idle");
  // Editor de Términos y Condiciones (2026-07-22, ver AGENTS.md §6.5): un
  // borrador separado (`termsDraft`) evita que cada tecleo dispare un
  // re-render del formulario completo de config; solo se vuelca a `config`
  // (y por lo tanto se envía) al pulsar "Guardar" dentro del propio modal.
  const [showTermsEditor, setShowTermsEditor] = useState(false);
  const [termsDraft, setTermsDraft] = useState(initialConfig.termsAndConditions);
  // Editor de frases épicas de derrota (2026-07-22, ver AGENTS.md §5.1) —
  // mismo patrón de borrador separado que Términos y Condiciones arriba.
  // Una frase por línea en el textarea — más práctico que 20-40 inputs
  // individuales para una lista de longitud libre.
  const [showPhrasesEditor, setShowPhrasesEditor] = useState(false);
  const [phrasesDraft, setPhrasesDraft] = useState(initialConfig.defeatPhrases.join("\n"));

  const handleSave = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved: GameConfig = await res.json();
      setConfig(saved);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>{t("configSectionTitle")}</h2>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("playerGroupTitle")}</span>
        <div className={styles.fieldRow}>
          {ABILITY_PLANETS.map((planet) => (
            <div key={planet} className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`player-base-speed-${planet}`}>
                {tPlanets(planet)} — {t("baseSpeedLabel")}
              </label>
              <FormattedNumberInput
                id={`player-base-speed-${planet}`}
                min={50}
                value={config.player.baseSpeedByPlanet[planet]}
                onChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    player: { baseSpeedByPlanet: { ...c.player.baseSpeedByPlanet, [planet]: v } },
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("abilitiesGroupTitle")}</span>
        {ABILITY_PLANETS.map((planet) => (
          <div key={planet} className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${planet}-duration`}>
                {tPlanets(planet)} — {t("durationLabel")}
              </label>
              <FormattedNumberInput
                id={`${planet}-duration`}
                min={0}
                value={config.abilities[planet].durationMs}
                onChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    abilities: { ...c.abilities, [planet]: { ...c.abilities[planet], durationMs: v } },
                  }))
                }
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${planet}-cooldown`}>
                {tPlanets(planet)} — {t("cooldownLabel")}
              </label>
              <FormattedNumberInput
                id={`${planet}-cooldown`}
                min={0}
                value={config.abilities[planet].cooldownMs}
                onChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    abilities: { ...c.abilities, [planet]: { ...c.abilities[planet], cooldownMs: v } },
                  }))
                }
              />
            </div>
          </div>
        ))}
      </div>

      {/* Parámetros de habilidades más allá de duración/recarga —
          pedido explícito del usuario (2026-07-24): "no puedo modificar el
          porcentaje de velocidad a la que corre mercurio, asi como la
          velocidad de la luna... si es inmune a llamaradas sol amarillo
          y/o a llamaradas rojas, el radio de afectacion de los asteroides
          que afecta a saturno, etc". Solo se exponen valores con un efecto
          real verificado en el motor — ver AGENTS.md §9. */}
      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("abilityParamsGroupTitle")}</span>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="mercury-speed-mult">
              {tPlanets("mercury")} — {t("speedMultiplierLabel")}
            </label>
            <FormattedNumberInput
              id="mercury-speed-mult"
              min={1}
              step={0.1}
              value={config.abilityParams.mercury.speedMultiplier}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, mercury: { ...c.abilityParams.mercury, speedMultiplier: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="mercury-slowfield-radius">
              {tPlanets("mercury")} — {t("slowfieldRadiusLabel")}
            </label>
            <FormattedNumberInput
              id="mercury-slowfield-radius"
              min={0}
              value={config.abilityParams.mercury.slowfieldRadius}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, mercury: { ...c.abilityParams.mercury, slowfieldRadius: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="mercury-slowfield-factor">
              {tPlanets("mercury")} — {t("slowfieldFactorLabel")}
            </label>
            <FormattedNumberInput
              id="mercury-slowfield-factor"
              min={0}
              max={1}
              step={0.05}
              value={config.abilityParams.mercury.slowfieldFactor}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, mercury: { ...c.abilityParams.mercury, slowfieldFactor: v } } }))
              }
            />
          </div>
          <label className={styles.planetCheckboxRow}>
            <input
              type="checkbox"
              checked={config.abilityParams.mercury.flareImmune}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  abilityParams: { ...c.abilityParams, mercury: { ...c.abilityParams.mercury, flareImmune: e.target.checked } },
                }))
              }
            />
            {tPlanets("mercury")} — {t("flareImmuneLabel")}
          </label>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.planetCheckboxRow}>
            <input
              type="checkbox"
              checked={config.abilityParams.venus.smallAsteroidImmune}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  abilityParams: { ...c.abilityParams, venus: { smallAsteroidImmune: e.target.checked } },
                }))
              }
            />
            {tPlanets("venus")} — {t("smallAsteroidImmuneLabel")}
          </label>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.planetCheckboxRow}>
            <input
              type="checkbox"
              checked={config.abilityParams.earth.flareImmune}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  abilityParams: { ...c.abilityParams, earth: { ...c.abilityParams.earth, flareImmune: e.target.checked } },
                }))
              }
            />
            {tPlanets("earth")} — {t("flareImmuneLabel")}
          </label>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="earth-moon-speed-mult">
              {tPlanets("earth")} — {t("moonActiveSpeedMultiplierLabel")}
            </label>
            <FormattedNumberInput
              id="earth-moon-speed-mult"
              min={1}
              step={0.5}
              value={config.abilityParams.earth.moonActiveSpeedMultiplier}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, earth: { ...c.abilityParams.earth, moonActiveSpeedMultiplier: v } } }))
              }
            />
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="mars-lava-range">
              {tPlanets("mars")} — {t("lavaRangeLabel")}
            </label>
            <FormattedNumberInput
              id="mars-lava-range"
              min={1}
              value={config.abilityParams.mars.lavaRange}
              onChange={(v) => setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, mars: { lavaRange: v } } }))}
            />
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="jupiter-ally-range">
              {tPlanets("jupiter")} — {t("allyShieldRangeLabel")}
            </label>
            <FormattedNumberInput
              id="jupiter-ally-range"
              min={1}
              value={config.abilityParams.jupiter.allyShieldRange}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, jupiter: { ...c.abilityParams.jupiter, allyShieldRange: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="jupiter-ally-heal">
              {tPlanets("jupiter")} — {t("allyHealLivesLabel")}
            </label>
            <FormattedNumberInput
              id="jupiter-ally-heal"
              min={1}
              value={config.abilityParams.jupiter.allyHealLives}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, jupiter: { ...c.abilityParams.jupiter, allyHealLives: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="jupiter-ally-stars">
              {tPlanets("jupiter")} — {t("allyRewardStarsLabel")}
            </label>
            <FormattedNumberInput
              id="jupiter-ally-stars"
              min={1}
              value={config.abilityParams.jupiter.allyRewardStars}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, jupiter: { ...c.abilityParams.jupiter, allyRewardStars: v } } }))
              }
            />
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="saturn-ring-repel-radius">
              {tPlanets("saturn")} — {t("ringRepelRadiusLabel")}
            </label>
            <FormattedNumberInput
              id="saturn-ring-repel-radius"
              min={1}
              value={config.abilityParams.saturn.ringRepelRadius}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, saturn: { ...c.abilityParams.saturn, ringRepelRadius: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="saturn-pulsar-solo">
              {tPlanets("saturn")} — {t("pulsarBoostSoloLabel")}
            </label>
            <FormattedNumberInput
              id="saturn-pulsar-solo"
              min={0}
              max={1}
              step={0.05}
              value={config.abilityParams.saturn.pulsarBoostSolo}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, saturn: { ...c.abilityParams.saturn, pulsarBoostSolo: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="saturn-pulsar-team">
              {tPlanets("saturn")} — {t("pulsarBoostTeamLabel")}
            </label>
            <FormattedNumberInput
              id="saturn-pulsar-team"
              min={0}
              max={1}
              step={0.05}
              value={config.abilityParams.saturn.pulsarBoostTeam}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, saturn: { ...c.abilityParams.saturn, pulsarBoostTeam: v } } }))
              }
            />
          </div>
          <label className={styles.planetCheckboxRow}>
            <input
              type="checkbox"
              checked={config.abilityParams.saturn.redFlareImmuneWhileActive}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  abilityParams: { ...c.abilityParams, saturn: { ...c.abilityParams.saturn, redFlareImmuneWhileActive: e.target.checked } },
                }))
              }
            />
            {tPlanets("saturn")} — {t("redFlareImmuneWhileActiveLabel")}
          </label>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="neptune-storm-radius">
              {tPlanets("neptune")} — {t("stormSlowfieldRadiusLabel")}
            </label>
            <FormattedNumberInput
              id="neptune-storm-radius"
              min={0}
              value={config.abilityParams.neptune.stormSlowfieldRadius}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, neptune: { ...c.abilityParams.neptune, stormSlowfieldRadius: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="neptune-storm-factor">
              {tPlanets("neptune")} — {t("stormSlowfieldFactorLabel")}
            </label>
            <FormattedNumberInput
              id="neptune-storm-factor"
              min={0}
              max={1}
              step={0.02}
              value={config.abilityParams.neptune.stormSlowfieldFactor}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, neptune: { ...c.abilityParams.neptune, stormSlowfieldFactor: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="neptune-aura-radius">
              {tPlanets("neptune")} — {t("auraSlowfieldRadiusLabel")}
            </label>
            <FormattedNumberInput
              id="neptune-aura-radius"
              min={0}
              value={config.abilityParams.neptune.auraSlowfieldRadius}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, neptune: { ...c.abilityParams.neptune, auraSlowfieldRadius: v } } }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="neptune-aura-factor">
              {tPlanets("neptune")} — {t("auraSlowfieldFactorLabel")}
            </label>
            <FormattedNumberInput
              id="neptune-aura-factor"
              min={0}
              max={1}
              step={0.02}
              value={config.abilityParams.neptune.auraSlowfieldFactor}
              onChange={(v) =>
                setConfig((c) => ({ ...c, abilityParams: { ...c.abilityParams, neptune: { ...c.abilityParams.neptune, auraSlowfieldFactor: v } } }))
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("earthMoonGroupTitle")}</span>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="earth-moon-speed">
              {t("earthMoonSpeedLabel")}
            </label>
            <FormattedNumberInput
              id="earth-moon-speed"
              min={0.1}
              step={0.1}
              value={config.earthMoon.baseSpeed}
              onChange={(v) => setConfig((c) => ({ ...c, earthMoon: { baseSpeed: v } }))}
            />
          </div>
        </div>
      </div>

      <SunConfigGroup
        titleKey="sunGroupTitle"
        idPrefix="sun"
        value={config.sun}
        onChange={(v) => setConfig((c) => ({ ...c, sun: v }))}
      />
      <SunConfigGroup
        titleKey="redSunGroupTitle"
        idPrefix="red-sun"
        value={config.redSun}
        onChange={(v) => setConfig((c) => ({ ...c, redSun: { ...v, minLevel: c.redSun.minLevel } }))}
        minLevel={{
          value: config.redSun.minLevel,
          onChange: (v) => setConfig((c) => ({ ...c, redSun: { ...c.redSun, minLevel: v } })),
        }}
      />

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("pulsarsGroupTitle")}</span>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pulsars-frequency">
              {t("spawnFrequencyLabel")}
            </label>
            <FormattedNumberInput
              id="pulsars-frequency"
              min={100}
              value={config.pulsars.spawnFrequencyMs}
              onChange={(v) => setConfig((c) => ({ ...c, pulsars: { spawnFrequencyMs: v } }))}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("starsGroupTitle")}</span>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="stars-frequency">
              {t("spawnFrequencyLabel")}
            </label>
            <FormattedNumberInput
              id="stars-frequency"
              min={100}
              value={config.stars.spawnFrequencyMs}
              onChange={(v) => setConfig((c) => ({ ...c, stars: { spawnFrequencyMs: v } }))}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("asteroidsGroupTitle")}</span>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="asteroids-frequency">
              {t("asteroidsFrequencyLabel")}
            </label>
            <FormattedNumberInput
              id="asteroids-frequency"
              min={120}
              value={config.asteroids.spawnFrequencyBaseMs}
              onChange={(v) => setConfig((c) => ({ ...c, asteroids: { ...c.asteroids, spawnFrequencyBaseMs: v } }))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="asteroids-min-speed">
              {t("asteroidsMinSpeedLabel")}
            </label>
            <FormattedNumberInput
              id="asteroids-min-speed"
              min={10}
              value={config.asteroids.minSpeed}
              onChange={(v) => setConfig((c) => ({ ...c, asteroids: { ...c.asteroids, minSpeed: v } }))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="asteroids-max-speed-bonus">
              {t("asteroidsMaxSpeedBonusLabel")}
            </label>
            <FormattedNumberInput
              id="asteroids-max-speed-bonus"
              min={0}
              value={config.asteroids.maxSpeedBonus}
              onChange={(v) => setConfig((c) => ({ ...c, asteroids: { ...c.asteroids, maxSpeedBonus: v } }))}
            />
          </div>
        </div>
      </div>

      <BlackHoleConfigGroup
        titleKey="blackHoleGroupTitle"
        idPrefix="bh"
        value={config.blackHole}
        onChange={(v) => setConfig((c) => ({ ...c, blackHole: v }))}
      />
      <BlackHoleConfigGroup
        titleKey="novaBlackHoleGroupTitle"
        idPrefix="nova-bh"
        value={config.novaBlackHole}
        onChange={(v) => setConfig((c) => ({ ...c, novaBlackHole: { ...v, minLevel: c.novaBlackHole.minLevel } }))}
        minLevel={{
          value: config.novaBlackHole.minLevel,
          onChange: (v) => setConfig((c) => ({ ...c, novaBlackHole: { ...c.novaBlackHole, minLevel: v } })),
        }}
      />
      <QuasarConfigGroup value={config.quasar} onChange={(v) => setConfig((c) => ({ ...c, quasar: v }))} />

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("whatsappGroupTitle")}</span>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="whatsapp-link">
            {t("whatsappLinkLabel")}
          </label>
          <input
            id="whatsapp-link"
            type="text"
            className={styles.fieldInputWide}
            value={config.whatsappLink}
            onChange={(e) => setConfig((c) => ({ ...c, whatsappLink: e.target.value }))}
          />
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("donationGroupTitle")}</span>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="donation-min">
              {t("minAmountLabel")}
            </label>
            <FormattedNumberInput
              id="donation-min"
              min={1}
              value={config.donation.minAmountCents / 100}
              onChange={(v) => setConfig((c) => ({ ...c, donation: { ...c.donation, minAmountCents: Math.round(v * 100) } }))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="donation-step">
              {t("stepLabel")}
            </label>
            <FormattedNumberInput
              id="donation-step"
              min={1}
              value={config.donation.stepCents / 100}
              onChange={(v) => setConfig((c) => ({ ...c, donation: { ...c.donation, stepCents: Math.round(v * 100) } }))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="donation-max">
              {t("maxAmountLabel")}
            </label>
            <FormattedNumberInput
              id="donation-max"
              min={1}
              value={config.donation.maxAmountCents / 100}
              onChange={(v) => setConfig((c) => ({ ...c, donation: { ...c.donation, maxAmountCents: Math.round(v * 100) } }))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="donation-reward">
              {t("rewardStarsLabel")}
            </label>
            <FormattedNumberInput
              id="donation-reward"
              min={0}
              value={config.donation.rewardStars}
              onChange={(v) => setConfig((c) => ({ ...c, donation: { ...c.donation, rewardStars: v } }))}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("termsGroupTitle")}</span>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => {
            // Recarga el borrador desde el config actual cada vez que se abre
            // — evita mostrar un borrador viejo si el modal ya se cerró y
            // reabrió sin guardar.
            setTermsDraft(config.termsAndConditions);
            setShowTermsEditor(true);
          }}
        >
          {t("editTermsButton")}
        </button>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("defeatPhrasesGroupTitle")}</span>
        <p className={styles.status}>{t("defeatPhrasesHint", { count: config.defeatPhrases.length })}</p>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => {
            setPhrasesDraft(config.defeatPhrases.join("\n"));
            setShowPhrasesEditor(true);
          }}
        >
          {t("editDefeatPhrasesButton")}
        </button>
      </div>

      <button type="button" className={styles.saveButton} onClick={handleSave} disabled={status === "saving"}>
        {status === "saving" ? t("saving") : t("saveButton")}
      </button>
      {status === "saved" && (
        <p className={styles.status} data-tone="success">
          {t("saved")}
        </p>
      )}
      {status === "error" && (
        <p className={styles.status} data-tone="error">
          {t("error")}
        </p>
      )}

      {showTermsEditor && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true">
          <div className={styles.termsEditorCard}>
            <span className={styles.groupTitle}>{t("editTermsButton")}</span>
            <textarea
              className={styles.termsTextarea}
              value={termsDraft}
              onChange={(e) => setTermsDraft(e.target.value)}
            />
            <div className={styles.confirmActions}>
              <button type="button" className={styles.saveButton} onClick={() => setShowTermsEditor(false)}>
                {t("cancelButton")}
              </button>
              <button
                type="button"
                className={styles.saveButton}
                onClick={() => {
                  // Vuelca el borrador al config real — el guardado en Mongo
                  // se dispara aparte, con el botón "Guardar" general del
                  // formulario (mismo PUT /api/admin/config para todo el
                  // documento, ver comentario de arriba del componente).
                  setConfig((c) => ({ ...c, termsAndConditions: termsDraft }));
                  setShowTermsEditor(false);
                }}
              >
                {t("applyTermsButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPhrasesEditor && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true">
          <div className={styles.termsEditorCard}>
            <span className={styles.groupTitle}>{t("editDefeatPhrasesButton")}</span>
            <p className={styles.status}>{t("defeatPhrasesEditorHint")}</p>
            <textarea
              className={styles.termsTextarea}
              value={phrasesDraft}
              onChange={(e) => setPhrasesDraft(e.target.value)}
            />
            <div className={styles.confirmActions}>
              <button type="button" className={styles.saveButton} onClick={() => setShowPhrasesEditor(false)}>
                {t("cancelButton")}
              </button>
              <button
                type="button"
                className={styles.saveButton}
                onClick={() => {
                  // Una frase por línea; se descartan líneas vacías (ej. al
                  // pegar texto con doble salto de línea) — el esquema exige
                  // al menos una frase no vacía en la lista final.
                  const phrases = phrasesDraft
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0);
                  if (phrases.length === 0) return;
                  setConfig((c) => ({ ...c, defeatPhrases: phrases }));
                  setShowPhrasesEditor(false);
                }}
              >
                {t("applyTermsButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
