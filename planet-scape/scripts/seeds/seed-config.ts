import { getDb } from "../../lib/db";
import spaceFacts from "./data/spaceFacts.json";
import { DEFAULT_GAME_CONFIG } from "../../lib/schemas/gameConfig";

/**
 * Ver AGENTS.md §7.1. Siembra `space_facts` (100 curiosidades) y el
 * documento único `game_config` (Fase 8 — balance editable por admin).
 */
async function main() {
  const db = await getDb();

  const facts = db.collection("space_facts");
  const existingFacts = await facts.countDocuments();
  if (existingFacts > 0) {
    console.log(`seed-config: space_facts ya tiene ${existingFacts} documentos, no se vuelve a sembrar.`);
  } else {
    const docs = spaceFacts.map((fact, index) => ({ key: index, ...fact }));
    await facts.insertMany(docs);
    await facts.createIndex({ key: 1 }, { unique: true });
    console.log(`seed-config: ${docs.length} space_facts insertados.`);
  }

  const config = db.collection("game_config");
  const existingDoc = await config.findOne({});
  if (!existingDoc) {
    // Si hay un enlace de WhatsApp en el entorno (ver .env.local), se usa como
    // valor inicial — a partir de ahí el admin lo administra desde Mongo.
    const whatsappLink = process.env.NEXT_PUBLIC_WHATSAPP_LINK || DEFAULT_GAME_CONFIG.whatsappLink;
    await config.insertOne({ ...DEFAULT_GAME_CONFIG, whatsappLink });
    console.log("seed-config: game_config insertado con los valores de lanzamiento.");
  } else {
    // Migración no destructiva (2026-07-22): agrega SOLO las claves nuevas
    // que falten (ej. abilities.jupiter/saturn al agregar esos planetas) —
    // nunca pisa valores ya personalizados por el admin. Sin esto,
    // GameConfigSchema.safeParse() fallaría contra un documento viejo y
    // getGameConfig() caería silenciosamente al DEFAULT_GAME_CONFIG completo.
    const missing: Record<string, unknown> = {};
    if (!existingDoc.abilities?.jupiter) missing["abilities.jupiter"] = DEFAULT_GAME_CONFIG.abilities.jupiter;
    if (!existingDoc.abilities?.saturn) missing["abilities.saturn"] = DEFAULT_GAME_CONFIG.abilities.saturn;
    // Neptuno (2026-07-23, ver AGENTS.md §5/§9) — mismo patrón aditivo.
    if (!existingDoc.abilities?.neptune) missing["abilities.neptune"] = DEFAULT_GAME_CONFIG.abilities.neptune;
    if (existingDoc.player?.baseSpeedByPlanet && !existingDoc.player.baseSpeedByPlanet.neptune) {
      missing["player.baseSpeedByPlanet.neptune"] = DEFAULT_GAME_CONFIG.player.baseSpeedByPlanet.neptune;
    }
    // Términos y Condiciones (2026-07-22, ver AGENTS.md §6.5) — mismo patrón
    // aditivo: si el documento ya existía antes de este campo, se siembra el
    // texto de lanzamiento una sola vez; si el admin ya lo editó, nunca se
    // vuelve a pisar (el `if` solo dispara cuando el campo no existe).
    if (!existingDoc.termsAndConditions) missing.termsAndConditions = DEFAULT_GAME_CONFIG.termsAndConditions;
    // Velocidad por planeta (2026-07-22, ver AGENTS.md §5) — antes un único
    // `player.baseSpeed` global; documentos con ese esquema viejo (o sin
    // `player` en absoluto) reciben `baseSpeedByPlanet` con el mismo valor
    // que ya tenían configurado en los 6 planetas, para no cambiar el
    // comportamiento real de golpe — a partir de ahí el admin los separa.
    if (!existingDoc.player?.baseSpeedByPlanet) {
      const legacySpeed = existingDoc.player?.baseSpeed ?? DEFAULT_GAME_CONFIG.player.baseSpeedByPlanet.mercury;
      missing.player = {
        baseSpeedByPlanet: {
          mercury: legacySpeed,
          venus: legacySpeed,
          earth: legacySpeed,
          mars: legacySpeed,
          jupiter: legacySpeed,
          saturn: legacySpeed,
          neptune: legacySpeed,
        },
      };
    }
    // Sol Rojo / Agujero Negro Nova (2026-07-22, ver AGENTS.md §5.1): antes
    // compartían la configuración del Sol amarillo/Agujero Negro clásico —
    // ahora son documentos independientes. Se siembran como una COPIA del
    // valor ya vigente del clásico (no del default de código) para que
    // "inicialmente sean las mismas" de verdad, incluso si el admin ya
    // había personalizado el clásico antes de este cambio.
    if (!existingDoc.redSun) {
      missing.redSun = { ...(existingDoc.sun ?? DEFAULT_GAME_CONFIG.sun), minLevel: DEFAULT_GAME_CONFIG.redSun.minLevel };
    } else if (existingDoc.redSun.minLevel === undefined) {
      // `minLevel` (nivel a partir del cual aparece, 2026-07-22, ver
      // AGENTS.md §5.1) es un campo nuevo agregado DESPUÉS de que `redSun`
      // ya existiera como documento independiente — se agrega aparte del
      // resto, sin pisar minFlares/maxFlares/spawnFrequencyMs ya editados.
      missing["redSun.minLevel"] = DEFAULT_GAME_CONFIG.redSun.minLevel;
    }
    if (!existingDoc.novaBlackHole) {
      missing.novaBlackHole = {
        ...(existingDoc.blackHole ?? DEFAULT_GAME_CONFIG.blackHole),
        minLevel: DEFAULT_GAME_CONFIG.novaBlackHole.minLevel,
      };
    } else if (existingDoc.novaBlackHole.minLevel === undefined) {
      missing["novaBlackHole.minLevel"] = DEFAULT_GAME_CONFIG.novaBlackHole.minLevel;
    }
    // Velocidad de la luna de la Tierra (2026-07-22, ver AGENTS.md §5) —
    // mismo patrón aditivo de siempre.
    if (!existingDoc.earthMoon) missing.earthMoon = DEFAULT_GAME_CONFIG.earthMoon;
    // Frases épicas de derrota (2026-07-22, ver AGENTS.md §5.1) — mismo patrón aditivo.
    if (!existingDoc.defeatPhrases) missing.defeatPhrases = DEFAULT_GAME_CONFIG.defeatPhrases;
    // Quasar (2026-07-24, ver AGENTS.md §5.1) — mismo patrón aditivo.
    if (!existingDoc.quasar) missing.quasar = DEFAULT_GAME_CONFIG.quasar;
    // Parámetros de habilidades (2026-07-24, ver AGENTS.md §9) — mismo
    // patrón aditivo; si el documento ya tiene `abilityParams` pero le falta
    // algún planeta nuevo en el futuro, se agregaría aquí con el mismo `if`.
    if (!existingDoc.abilityParams) missing.abilityParams = DEFAULT_GAME_CONFIG.abilityParams;
    // Rango de asteroides (2026-07-26, ver AGENTS.md §9) — mismo patrón aditivo.
    if (!existingDoc.asteroids) missing.asteroids = DEFAULT_GAME_CONFIG.asteroids;
    if (Object.keys(missing).length > 0) {
      await config.updateOne({ _id: existingDoc._id }, { $set: missing });
      console.log("seed-config: game_config migrado con las claves nuevas faltantes:", Object.keys(missing));
    } else {
      console.log("seed-config: game_config ya existe y está completo, no se vuelve a sembrar.");
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("seed-config failed:", err);
  process.exit(1);
});
