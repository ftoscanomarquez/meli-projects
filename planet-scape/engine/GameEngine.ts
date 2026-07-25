import { Application, Container, Graphics, Sprite, Text } from "pixi.js";
import { buildEngineTextures, loadPlanetTexture, type EngineTextures } from "./textures";
import type { PlanetKey } from "./characterSvg";
import { createSeededRng, randomSeed, type Rng } from "./rng";
import type { MultiplayerConfig } from "./multiplayer/types";
import { ParallaxBackground, getBackgroundSpeedMultiplier } from "./systems/parallaxSystem";
import { ZodiacLayer } from "./systems/zodiacLayer";
import { Sun, RED_SUN_PALETTE } from "./entities/Sun";
import { BlackHole } from "./entities/BlackHole";
import { Quasar } from "./entities/Quasar";
import { Player } from "./entities/Player";
import { FieldObject } from "./entities/FieldObject";
import { FaceOverlay } from "./entities/FaceOverlay";
import { DeathSequence } from "./entities/DeathSequence";
import { speakDefeatPhrase, stopDefeatSpeech } from "./audio/speech";
import { spawnAsteroid, spawnPulsar, spawnStar } from "./systems/spawnSystem";
import {
  buildFlareParticles,
  buildRedFlareParticles,
  buildLavaParticles,
  buildAbsorbParticles,
  buildTrailParticles,
  buildExplosionParticles,
  buildIceShatterParticles,
  buildRockShatterParticles,
  buildDustParticles,
  buildAuroraParticles,
  buildNeonDustParticles,
  ParticlePool,
} from "./particles/ParticlePool";
import { InputController } from "./controls/InputController";
import { MercuryAbility, NoAbility } from "./abilities/mercuryAbility";
import { VenusAbility } from "./abilities/venusAbility";
import { EarthAbility, EARTH_MOON_ORBIT_RADIUS } from "./abilities/earthAbility";
import { MarsAbility, MARS_LAVA_RANGE } from "./abilities/marsAbility";
import { JupiterAbility } from "./abilities/jupiterAbility";
import { SaturnAbility } from "./abilities/saturnAbility";
import { NeptuneAbility } from "./abilities/neptuneAbility";
import type { PlanetAbility } from "./abilities/types";
import { useGameStore } from "./store/gameStore";
import { DEFAULT_GAME_CONFIG, type GameConfig } from "@/lib/schemas/gameConfig";
import { circlesOverlap } from "./collision";
import { BackgroundMusic, type MusicChoice } from "./audio/backgroundMusic";
import { clientLog } from "@/lib/clientLog";

const HUD_SYNC_INTERVAL_MS = 100; // el HUD no necesita más de ~10 Hz — ver AGENTS.md §3.1

// Tope de vidas — pedido explícito del usuario (2026-07-24): "el tema de
// las vidas o los corazones estan topados a 10 al inicio, pero si agarran
// mas pueden llegar a 16". El jugador SIEMPRE arranca con 10 (ver
// gameStore.ts `lives: 10`, sin cambios) — este tope solo se aplica al
// curar (pulsares, bono de compañero de Júpiter), para permitir subir por
// encima del inicial recolectando más.
const MAX_LIVES = 16;

// Color del anillo indicador de "habilidad activa" sobre jugadores remotos
// (ver `remotePlayers.abilityIndicator`) — mismo tono que cada planeta ya
// usa para su propio efecto local, para que sea reconocible sin necesitar
// replicar el efecto exacto de cada uno.
const ABILITY_INDICATOR_COLOR: Record<PlanetKey, number> = {
  mercury: 0x8ff5ff,
  venus: 0x9bff5c,
  earth: 0xe4e6f0,
  mars: 0xff6a3d,
  jupiter: 0xffc93c,
  saturn: 0xb35cff,
  neptune: 0x5ec8ff,
};

// Ayuda entre compañeros (2026-07-23, ver AGENTS.md §8.2) — pedido explícito
// del usuario: "las habilidades debe de proteger al otro jugador... es como
// emular que se ayudan juntas". Mismo rango que el bono de compañero de
// Júpiter (ya establecido, ver `tryShieldNearestAlly()`).
const ALLY_AID_RANGE = 260;

// Umbral de "asteroide pequeño" para la pasiva de Venus (2026-07-24, ver
// AGENTS.md §5) — coincide con el techo del primer tier de
// spawnSystem.ts#ASTEROID_SIZE_TIERS ("chicos": 13-22). `obj.radius` ya
// incluye `entityScale` al spawnear (ver spawnAsteroid()), así que este
// umbral también debe escalarse.
const SMALL_ASTEROID_RADIUS = 22;
// Rango en el que un asteroide pequeño empieza a "calentarse" cerca de
// Venus antes de tocarlo — mismo orden de magnitud que otros radios de
// proximidad del motor (ej. el repelido de Saturno, 160px).
const VENUS_HEAT_RANGE = 170;

// Estado combinado de ayuda recibida de TODOS los compañeros cercanos con
// su habilidad activa ahora mismo — se recalcula cada cuadro desde cero en
// `updateAllyAid()` (nunca se "activa"/"desactiva" con temporizador propio,
// simplemente refleja la proximidad+estado en vivo de cada compañero, ya
// sincronizados vía `sendPosition`/`abilityState`). Júpiter no aparece aquí
// — su ayuda (escudo mutuo + curación) ya tiene su propio mecanismo
// dedicado y más rico (`tryShieldNearestAlly()`), no se duplica.
type AllyAidState = {
  invulnerable: boolean; // Venus
  redFlareImmune: boolean; // Saturno
  ringRepelActive: boolean; // Saturno
  slowfieldRadius: number; // Mercurio
  slowfieldFactor: number; // Mercurio
  destroyRadius: number; // Tierra/Marte — desintegra asteroides cercanos
};

const NEUTRAL_ALLY_AID: AllyAidState = {
  invulnerable: false,
  redFlareImmune: false,
  ringRepelActive: false,
  slowfieldRadius: 0,
  slowfieldFactor: 1,
  destroyRadius: 0,
};

/** Traduce la habilidad activa de UN compañero cercano a lo que le otorga al jugador local — ver AGENTS.md §8.2. */
function mergeAllyAid(aid: AllyAidState, planet: PlanetKey): void {
  switch (planet) {
    case "mercury":
      // "la distorsión temporal de Mercurio también protege" — mismo campo
      // de ralentización de asteroides que Mercurio se da a sí mismo.
      aid.slowfieldRadius = Math.max(aid.slowfieldRadius, 260);
      aid.slowfieldFactor = Math.min(aid.slowfieldFactor, 0.4);
      break;
    case "venus":
      aid.invulnerable = true;
      break;
    case "earth":
      // "la luna de Tierra me protege" — desintegra asteroides cercanos al
      // ALIADO (no solo a los que toca la luna de Tierra).
      aid.destroyRadius = Math.max(aid.destroyRadius, 90);
      break;
    case "mars":
      aid.destroyRadius = Math.max(aid.destroyRadius, MARS_LAVA_RANGE);
      break;
    case "saturn":
      aid.ringRepelActive = true;
      aid.redFlareImmune = true;
      break;
    case "jupiter":
      break; // ver comentario de AllyAidState arriba — mecanismo propio.
    // "neptune" a propósito no tiene case aquí — su ayuda de equipo es
    // `teamStormActive` (ver `updateMultiplayer()`), de SALA completa sin
    // importar la distancia, no por proximidad como el resto.
  }
}

// Umbral de nivel de las constelaciones del zodiaco (puramente decorativas,
// ver AGENTS.md §4/§5.1) — a diferencia del Sol Rojo/Agujero Negro Nova
// (abajo), este no se pidió configurable desde admin, se queda fijo.
const ZODIAC_LEVEL = 40;

// El Sol Rojo y el Agujero Negro Nova se CONSTRUYEN siempre en mount() (para
// no alterar el orden de consumo del `rng` compartido según el nivel local
// de cada cliente, ver comentario de RNG en Sun.ts/RETROSPECTIVA.md) pero su
// `update()` solo se llama una vez alcanzado `game_config.redSun.minLevel`/
// `novaBlackHole.minLevel` (editable por admin, sin piso mínimo — la
// restricción de "nunca por debajo de 20" se removió a pedido explícito del
// usuario 2026-07-22 para poder validar ambas features en niveles bajos;
// los valores por defecto siguen siendo 45/60) — antes de alcanzar el nivel
// configurado quedan completamente inertes (invisibles, fase "hidden" para
// siempre).

/**
 * Orquestador del motor de juego (Fase 3, single-player) — ver AGENTS.md §2
 * y §4. Todo el estado de física/posición vive aquí, fuera de React; solo
 * se sincroniza al store de Zustand a intervalos bajos para el HUD.
 */
export class GameEngine {
  readonly app = new Application();
  private textures!: EngineTextures;
  private background!: ParallaxBackground;
  private sun!: Sun;
  private blackHole!: BlackHole;
  // Peligros avanzados (ver AGENTS.md §5.1) — Sol Rojo (nivel 45+, llamaradas
  // que ningún escudo bloquea) y Agujero Negro Nova (nivel 60+, triplica la
  // frecuencia de asteroides mientras está activo). Ver umbrales arriba.
  private redSun!: Sun;
  private novaBlackHole!: BlackHole;
  // Quasar (nivel 55+ configurable, ver AGENTS.md §5.1) — fusión de
  // `blackHole`+`novaBlackHole` cuando ambos están activos a la vez en un
  // nivel válido. No consume `rng` compartido (su disparo depende solo de
  // `level`/las posiciones ya deterministas de los dos agujeros negros), así
  // que no agrega ningún riesgo nuevo de desincronización en multijugador
  // más allá del ya documentado para `novaBlackHole.minLevel` en RETROSPECTIVA.md.
  private quasar!: Quasar;
  private quasarRayParticles!: ParticlePool;
  private zodiacLayer!: ZodiacLayer;
  // Targeting FIFO entre `blackHole`/`novaBlackHole` cuando ambos están
  // activos a la vez — ver BlackHole.ts#activationOrder y AGENTS.md §5.1.
  private nextBlackHoleActivationOrder = 0;
  private player!: Player;
  // Mercurio/Venus/Tierra/Marte tienen habilidad implementada (Fase 4).
  // Júpiter (multijugador, Fase 5) y Saturno (no seleccionable todavía,
  // Fase 8) quedan en NoAbility — ver AGENTS.md §15. Asignado en el
  // constructor, no como field initializer, para no depender del orden de
  // inicialización relativo al parameter property `planet`.
  private ability: PlanetAbility;
  private input!: InputController;
  private music = new BackgroundMusic();
  private gameLayer = new Container();

  // Visuales de habilidad específicos por planeta (Fase 4) — solo se crea
  // el que corresponde al planeta jugado.
  private venusShield?: Graphics;
  // Aura propia de Júpiter al activar su habilidad — pedido explícito del
  // usuario (2026-07-22): "se supone que también hay un aura que lo
  // protege a él". Ya era invulnerable funcionalmente (`JupiterAbility
  // #invulnerable`), pero no tenía ningún indicador visual propio (a
  // diferencia de Venus) — brecha real, corregida aquí.
  private jupiterShieldVisual?: Graphics;
  // Anillo defensivo de Saturno al activar su habilidad — pedido explícito
  // del usuario (2026-07-22): "su anillo empieza a girar parpadeando y
  // girando rapidamente ... para defender". Gira sobre su propio eje y
  // parpadea mientras `ringRepelActive` está encendido — ver
  // `updateAbilityVisuals()`.
  private saturnRingVisual?: Graphics;
  // Aura helada de Neptuno — pedido explícito del usuario (2026-07-23):
  // "quiero un diseño muy bonito y que brille y parpadee". A diferencia de
  // los demás visuales de habilidad, este es SIEMPRE visible (rasgo propio
  // del personaje, no depende de `isActive`) — parpadea todo el tiempo, y
  // se agranda/intensifica mientras la Tormenta de Neptuno está activa (ver
  // `updateAbilityVisuals()`).
  private neptuneAuraVisual?: Graphics;
  // Aro protector visible sobre el jugador LOCAL cuando lo protege el
  // bono de compañero de Júpiter (`externalShieldMs > 0`) — pedido
  // explícito del usuario (2026-07-23): "recuerda que tambien a mi me debe
  // de aparecer el mismo aro protecto que a jupiter para saber que estoy
  // protegido por el". A diferencia de `jupiterShieldVisual` (solo si el
  // planeta local ES Júpiter), este se construye SIEMPRE sin importar el
  // planeta que se esté jugando, porque cualquiera puede ser protegido.
  private externalShieldVisual!: Graphics;
  // Ayuda entre compañeros — ver AGENTS.md §8.2 y `mergeAllyAid()` arriba.
  // Recalculado cada cuadro en `updateAllyAid()`, nunca mutado a mano fuera
  // de ese método.
  private allyAid: AllyAidState = { ...NEUTRAL_ALLY_AID };
  // Tormenta de Neptuno sentida en toda la sala — ver comentario en
  // `mergeAllyAid()` y AGENTS.md §8.2. `true` si CUALQUIER compañero
  // Neptuno tiene su habilidad activa ahora mismo, sin importar la
  // distancia. Recalculado cada cuadro en `updateMultiplayer()`.
  private teamStormActive = false;
  private allyAidVisual!: Graphics;
  private earthMoon?: Graphics;
  private earthMoonAngle = 0;
  private marsLavaBurstTimer = 0;
  private slowfieldBlinkTimer = 0;
  private mercuryTrailTimer = 0;

  private fieldObjects: FieldObject[] = [];
  private flareParticles!: ParticlePool;
  // Llamaradas del Sol Rojo — canal aparte, ver AGENTS.md §5.1 (ningún
  // escudo/inmunidad las bloquea, se revisan sin las excepciones normales).
  private redFlareParticles!: ParticlePool;
  // Canal de lava independiente — ver AGENTS.md §4 ("corrección de rendimiento").
  // Solo Marte lo usa; queda listo para cuando se implemente en Fase 4.
  private lavaParticles!: ParticlePool;
  private absorbParticles!: ParticlePool;
  // Rastro de luz de Mercurio en súper-velocidad — solo Mercurio lo usa.
  private trailParticles!: ParticlePool;
  // Explosión final al morir — ver DeathSequence.ts y AGENTS.md §5.1.
  private explosionParticles!: ParticlePool;
  // Añicos al destruir un asteroide — hielo (congelado por Neptuno, sin
  // importar quién lo toque) y roca (Mercurio a súper-velocidad) — pedido
  // explícito del usuario (2026-07-23): "que se vea mas epico el poder de
  // neptuno" / "obvio no congelados pero se hacen cachitos". Ver AGENTS.md §5.
  private iceShatterParticles!: ParticlePool;
  private rockShatterParticles!: ParticlePool;
  // Polvo de Venus al destruir asteroides pequeños — pedido explícito del
  // usuario (2026-07-24): "al chocar con venus se vuelven polvo". Solo Venus
  // lo usa. Ver engine/abilities/venusAbility.ts.
  private dustParticles!: ParticlePool;
  // Aurora boreal de la Tierra al recibir una llamarada del Sol amarillo
  // (nunca le hace daño) — pedido explícito del usuario (2026-07-24): "cada
  // vez que lo impactan... provoca una pequeña animacion de aurora boreal
  // donde lo impacto". Solo Tierra lo usa. Ver engine/abilities/earthAbility.ts.
  private auroraParticles!: ParticlePool;
  // Explosión de polvo de colores neón al fusionarse el Quasar — ver
  // AGENTS.md §5.1 y Quasar.ts#takeJustActivated().
  private neonDustParticles!: ParticlePool;

  // Barrita de estado de habilidad bajo el personaje — ver AGENTS.md §5
  // ("verde/cian brillante" listo, "rosa/magenta" activa, "gris" recarga).
  private abilityBar = new Container();
  private abilityBarFill = new Graphics();

  // Reacciones faciales chistosas (2026-07-22, ver AGENTS.md §5.1 y
  // FaceOverlay.ts) — cualquier golpe que no mate dispara una al azar.
  private faceOverlay!: FaceOverlay;
  // Secuencia de muerte del jugador LOCAL — ver DeathSequence.ts. Los
  // jugadores remotos tienen la suya propia dentro de `remotePlayers`.
  private deathSequence!: DeathSequence;
  // Frases flotantes (frase épica de derrota de OTRO jugador, mostrada
  // sobre su sprite — pedido explícito del usuario: "la frase épica también
  // es vista por los demás jugadores") — lista corta, actualizada a mano
  // cada cuadro (no amerita un ParticlePool completo).
  private floatingTexts: { text: Text; remainingMs: number }[] = [];

  private width = 0;
  private height = 0;
  // Tamaño de entidades relativo al viewport — ver mount(). 1 = escritorio.
  private entityScale = 1;
  // Ritmo del juego (velocidad de asteroides/jugador + frecuencia de
  // aparición de asteroides) relativo al tamaño real de la pantalla —
  // pedido explícito del usuario (2026-07-24): "en mobile salen mas [asteroides]
  // y mas rapidos... me gustaria que el PC fuera igual de rapido que en
  // mobile". La velocidad/frecuencia absolutas (px/s, ms entre spawns) eran
  // idénticas en cualquier dispositivo — en una pantalla de escritorio
  // mucho más grande que un celular, esos mismos números absolutos cruzan
  // una fracción menor de la pantalla por segundo, así que se sentía más
  // lento/con menos asteroides en pantalla a la vez. `entityScale` ya
  // resuelve esto para el TAMAÑO de las entidades (se achica en pantallas
  // angostas); `paceScale` es el mismo criterio pero para el RITMO, sin
  // techo en 1 (crece en pantallas más grandes que la referencia de 900px,
  // en vez de solo achicarse en pantallas más chicas).
  private paceScale = 1;
  // Prueba explícita del usuario (2026-07-24): "en modo laptop la velocidad
  // de los planetas se siente muy lentos, quiero que les subas la
  // velocidad de movimiento... suba al doble para ver si asi se siente
  // mejor". Multiplicador FIJO (no proporcional al ancho como `paceScale`)
  // — el usuario pidió probar exactamente "el doble", no una escala
  // variable — solo en PC/laptop (mismo umbral de 900px que `entityScale`)
  // y nunca en multijugador.
  private playerPaceMultiplier = 1;
  private level = 0;
  private asteroidTimer = 350; // bajado tras feedback real del usuario (2026-07-22): "más asteroides al principio"
  private pulsarTimer = 4200;
  private starTimer = 2600;
  private hudSyncTimer = 0;
  private posSyncTimer = 0;
  // Vidas/estrellas propias hacia el equipo — puramente informativo (ver
  // GameHud.tsx panel desplegable, AGENTS.md §8), no afecta la física de
  // nadie. Frecuencia baja para no saturar la sala (~1 msg/s).
  private statusSyncTimer = 0;
  // Última habilidad activa que se avisó al equipo — evita reenviar el
  // mismo estado en cada cuadro, ver AGENTS.md §8.
  private lastAbilityActiveSent = false;
  private destroyed = false;
  // `app.destroy()` solo es seguro una vez `app.init()` resolvió — ver
  // `destroy()` y RETROSPECTIVA.md (React Strict Mode en dev invoca el
  // efecto mount/cleanup/mount dos veces; sin esta bandera, un cleanup que
  // llega mientras `init()` sigue pendiente rompe los listeners internos
  // de PixiJS en vez de simplemente no tener nada que destruir todavía).
  private initialized = false;
  private sessionReported = false;
  // Guardado incremental cada 5 estrellas (ver AGENTS.md §7.3) — evita
  // mandar dos POST superpuestos si el jugador recolecta varias estrellas
  // muy seguido, antes de que el primer guardado silencioso responda.
  private committingStars = false;

  // Determinista: se fija en mount() con la semilla de la sala (multijugador)
  // o una semilla real (solo). Ver engine/rng.ts y AGENTS.md §8.
  private rng!: Rng;

  // Multijugador (Fase 5, opcional) — ver engine/multiplayer/types.ts.
  // `faceOverlay`/`deathSequence` propios por jugador remoto (2026-07-22,
  // ver AGENTS.md §5.1) — para reproducir SU reacción/muerte tal cual la
  // vive del otro lado, no la del jugador local.
  private remotePlayers = new Map<
    string,
    {
      sprite: Sprite;
      targetX: number;
      targetY: number;
      label: Text;
      faceOverlay: FaceOverlay;
      deathSequence: DeathSequence;
      // Indicador genérico de "habilidad activa" sobre este jugador remoto
      // — pedido explícito del usuario (2026-07-23): "se debe de ver
      // tambien nuestra habilidad en todas las sesiones porque se supone
      // que estamos jugando juntos y quiero saber si alguien activo su
      // habilidad". Un anillo pulsante coloreado según SU planeta (no una
      // réplica exacta del efecto de cada habilidad — serían 6 sistemas de
      // partículas remotos más, ver AGENTS.md §4 sobre restricción visual),
      // visible mientras `abilityActive` esté encendido.
      abilityIndicator: Graphics;
      abilityActive: boolean;
      // Necesario para saber QUÉ tipo de ayuda otorga su habilidad activa
      // al jugador local si está cerca — ver `updateAllyAid()`.
      planet: PlanetKey;
    }
  >();
  private unsubscribers: Array<() => void> = [];
  // Bono de compañero de Júpiter recibido de OTRO jugador (ver
  // `tryShieldNearestAlly()` y AGENTS.md §5) — invulnerabilidad temporal
  // independiente de la propia habilidad de este jugador (puede estar
  // jugando cualquier planeta, no solo Júpiter). Cuenta regresiva en ms.
  private externalShieldMs = 0;
  // Pasiva de pulsares de Saturno compartida con TODO el equipo (2026-07-23,
  // ver AGENTS.md §8.2) — pedido explícito del usuario: "a todos los
  // integrantes de la sala les comparte esa habilidad pasiva". Por
  // compañero (`id` → su boost), para que si alguno se desconecta no se
  // pierda el resto; `updateSpawns()` usa el máximo entre el propio y estos.
  private teamPulsarBoosts = new Map<string, number>();
  // Alias encima del sprite — pedido explícito del usuario (2026-07-22):
  // distinguir jugadores cuando eligen el mismo planeta. Azul fuerte = uno
  // mismo, gris delgado = los demás — ver AGENTS.md §6.4. Solo existe en
  // multijugador (`this.multiplayer` presente); en solo no hay nadie más
  // con quien confundirse.
  private localNameLabel?: Text;

  constructor(
    private planet: PlanetKey,
    private multiplayer?: MultiplayerConfig,
    // Fase 8 — ver AGENTS.md §9: valores editables por admin (game_config),
    // leídos server-side y pasados aquí. Sin config explícita, usa los
    // valores de lanzamiento (mismo comportamiento que Fases 3-7).
    private gameConfig: GameConfig = DEFAULT_GAME_CONFIG,
    // Estrellas ya acumuladas del jugador (session.stars) — ver
    // engine/store/gameStore.ts. Solo afecta lo que se MUESTRA en el HUD,
    // nunca lo que se manda a /api/sessions/complete.
    private initialStars = 0,
    // Elegido en `MusicPicker` antes de montar (ver AGENTS.md §4/§6.4) —
    // `undefined` = rotación aleatoria entre las 4 melodías de siempre.
    private musicChoice?: MusicChoice,
  ) {
    const { abilities, abilityParams } = gameConfig;
    switch (planet) {
      case "mercury":
        this.ability = new MercuryAbility(
          abilities.mercury.durationMs,
          abilities.mercury.cooldownMs,
          abilityParams.mercury.speedMultiplier,
          abilityParams.mercury.slowfieldRadius,
          abilityParams.mercury.slowfieldFactor,
          abilityParams.mercury.flareImmune,
        );
        break;
      case "venus":
        this.ability = new VenusAbility(abilities.venus.durationMs, abilities.venus.cooldownMs, abilityParams.venus.smallAsteroidImmune);
        break;
      case "earth":
        this.ability = new EarthAbility(
          abilities.earth.durationMs,
          abilities.earth.cooldownMs,
          abilityParams.earth.flareImmune,
          abilityParams.earth.moonActiveSpeedMultiplier,
        );
        break;
      case "mars":
        this.ability = new MarsAbility(abilities.mars.durationMs, abilities.mars.cooldownMs);
        break;
      case "jupiter":
        this.ability = new JupiterAbility(abilities.jupiter.durationMs, abilities.jupiter.cooldownMs);
        break;
      case "saturn":
        // Pasa si la partida es en equipo (`this.multiplayer` presente,
        // mismo criterio que Júpiter en `tryShieldNearestAlly()`) para que
        // la pasiva de pulsares duplique en vez de solo +30% — ver AGENTS.md
        // §5 y engine/abilities/saturnAbility.ts.
        this.ability = new SaturnAbility(
          abilities.saturn.durationMs,
          abilities.saturn.cooldownMs,
          !!this.multiplayer,
          abilityParams.saturn.pulsarBoostSolo,
          abilityParams.saturn.pulsarBoostTeam,
          abilityParams.saturn.redFlareImmuneWhileActive,
        );
        break;
      case "neptune":
        this.ability = new NeptuneAbility(
          abilities.neptune.durationMs,
          abilities.neptune.cooldownMs,
          abilityParams.neptune.stormSlowfieldRadius,
          abilityParams.neptune.stormSlowfieldFactor,
          abilityParams.neptune.auraSlowfieldRadius,
          abilityParams.neptune.auraSlowfieldFactor,
        );
        break;
      default:
        this.ability = new NoAbility();
    }
  }

  async mount(container: HTMLElement) {
    await this.app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    if (this.destroyed) {
      // `destroy()` llegó mientras `init()` seguía pendiente — recién ahora
      // es seguro destruir la app, y no hay que construir nada más.
      this.app.destroy(true, { children: true });
      return;
    }
    this.initialized = true;
    container.appendChild(this.app.canvas);

    this.width = this.app.screen.width;
    this.height = this.app.screen.height;
    this.rng = createSeededRng(this.multiplayer?.seed ?? randomSeed());

    // Escala reducida en pantallas chicas (celular) — en un viewport angosto
    // el jugador/Sol/asteroides a tamaño de escritorio se ven amontonados y
    // dejan poco espacio para reaccionar. Feedback real del usuario
    // (2026-07-22): "en el cel deberían estar a escala menor". 900px de
    // referencia = ancho típico ya "de escritorio" en el motor. Piso bajado
    // de 0.55 a 0.42 — pedido explícito del usuario: "puedes reducir un poco
    // más la escala para que abarque un poco más" (más espacio de reacción
    // en pantallas angostas). El tamaño de escritorio/laptop (≥900px) no cambia.
    const sizeRatio = Math.min(this.width, this.height) / 900;
    this.entityScale = Math.max(0.42, Math.min(1, sizeRatio));
    // Basado en el ANCHO (no en `min(width,height)` como entityScale) — un
    // laptop/PC típico es ancho pero no necesariamente muy alto (muchos
    // miden 720-800px de alto), así que `min(width,height)` casi nunca
    // superaba el umbral y no aumentaba nada ahí. Pedido explícito del
    // usuario (2026-07-24), reforzado dos veces en vivo: primero "los
    // meteoritos van lentos, salen muy pocos al principio... en mobile
    // salen mas y mas rapidos", después "increméntalo más... solo al PC y
    // Laptop, en mobile no le muevas nada", y de nuevo "en modo laptop o PC
    // salen muy pocos asteroides, deben salir mas" — subido de un tope de
    // 2.2x (referencia 800px) a 3x (referencia 650px). `entityScale`
    // (tamaño visual) no cambia — esto es solo ritmo (velocidad/frecuencia
    // de asteroides). Solo en solitario: en multijugador cada cliente
    // simula el MISMO asteroide a partir del mismo `rng` compartido
    // (lockstep, ver AGENTS.md §8) — si cada quien lo moviera a una
    // velocidad distinta según su propia pantalla, la posición real
    // divergiría entre clientes y dejaría de ser "el mismo asteroide en el
    // mismo lugar" para todos.
    this.paceScale = this.multiplayer ? 1 : Math.min(3, Math.max(1, this.width / 650));
    this.playerPaceMultiplier = !this.multiplayer && sizeRatio >= 1 ? 2 : 1;

    this.textures = buildEngineTextures(this.app.renderer);
    this.background = new ParallaxBackground(this.app.renderer, this.width, this.height);
    // Capa de constelaciones de los Caballeros del Zodiaco (nivel 40+, ver
    // AGENTS.md §5.1/§4) — entre el fondo lejano y la capa de juego, misma
    // profundidad visual que el resto de la decoración de fondo. Invisible
    // hasta llegar al nivel (ver tick()).
    this.zodiacLayer = new ZodiacLayer(this.width, this.height);
    this.zodiacLayer.container.visible = false;
    this.app.stage.addChild(...this.background.layers, this.zodiacLayer.container, this.gameLayer);

    this.sun = new Sun(this.width, this.height, this.rng, this.gameConfig.sun);
    this.sun.container.scale.set(this.entityScale);
    this.blackHole = new BlackHole(this.width, this.height, this.rng, {
      ...this.gameConfig.blackHole,
      size: this.gameConfig.blackHole.size * this.entityScale,
    });
    // Sol Rojo y Agujero Negro Nova (nivel mínimo configurable por admin,
    // ver AGENTS.md §5.1) — construidos siempre (mismo motivo explicado
    // arriba de esta clase) — sus contenedores empiezan invisibles por
    // defecto (Sun/BlackHole ya nacen así) y solo se "despiertan" cuando su
    // `update()` empieza a llamarse en tick().
    // Configuración independiente del Sol Rojo/Agujero Negro Nova (2026-07-22,
    // pedido explícito del usuario: "aunque inicialmente son las mismas,
    // permite que cada quien tenga su configuración") — `game_config.redSun`/
    // `game_config.novaBlackHole`, ya no comparten el mismo documento que el
    // clásico (ver lib/schemas/gameConfig.ts).
    this.redSun = new Sun(this.width, this.height, this.rng, this.gameConfig.redSun, RED_SUN_PALETTE, true);
    this.redSun.container.scale.set(this.entityScale);
    this.novaBlackHole = new BlackHole(
      this.width,
      this.height,
      this.rng,
      { ...this.gameConfig.novaBlackHole, size: this.gameConfig.novaBlackHole.size * this.entityScale },
      "nova",
    );
    // Quasar (nivel 55+ configurable, ver AGENTS.md §5.1) — se construye
    // siempre (mismo motivo que redSun/novaBlackHole arriba), inactivo
    // ("idle") hasta que el clásico y el Nova estén activos a la vez.
    this.quasar = new Quasar({ ...this.gameConfig.quasar, size: this.gameConfig.quasar.size * this.entityScale });
    this.gameLayer.addChild(
      this.sun.container,
      this.blackHole.container,
      this.redSun.container,
      this.novaBlackHole.container,
      this.quasar.container,
    );

    this.pulsarTimer = this.gameConfig.pulsars.spawnFrequencyMs;
    this.starTimer = this.gameConfig.stars.spawnFrequencyMs;

    this.flareParticles = buildFlareParticles(this.gameLayer);
    this.redFlareParticles = buildRedFlareParticles(this.gameLayer);
    this.lavaParticles = buildLavaParticles(this.gameLayer);
    this.absorbParticles = buildAbsorbParticles(this.gameLayer);
    this.trailParticles = buildTrailParticles(this.gameLayer);
    this.explosionParticles = buildExplosionParticles(this.gameLayer);
    this.iceShatterParticles = buildIceShatterParticles(this.gameLayer);
    this.rockShatterParticles = buildRockShatterParticles(this.gameLayer);
    this.dustParticles = buildDustParticles(this.gameLayer);
    this.auroraParticles = buildAuroraParticles(this.gameLayer);
    this.neonDustParticles = buildNeonDustParticles(this.gameLayer);

    const playerTexture = await loadPlanetTexture(this.planet);
    if (this.destroyed) return;
    this.player = new Player(playerTexture, this.width, this.height, this.entityScale);
    const abilityBarBg = new Graphics().roundRect(-30, -4, 60, 8, 4).fill({ color: 0x000000, alpha: 0.35 });
    this.abilityBar.addChild(abilityBarBg, this.abilityBarFill);
    // Reacciones faciales / secuencia de muerte del jugador local — ver
    // AGENTS.md §5.1, FaceOverlay.ts y DeathSequence.ts.
    this.faceOverlay = new FaceOverlay();
    this.deathSequence = new DeathSequence(this.player.sprite, this.faceOverlay, this.explosionParticles, this.player.radius);
    this.gameLayer.addChild(this.player.sprite, this.abilityBar, this.faceOverlay.container, this.deathSequence.container);

    // Aro de protección de Júpiter sobre el jugador LOCAL cuando lo protege
    // un compañero — ver comentario del campo arriba. Se construye SIEMPRE
    // (no solo si `this.planet === "jupiter"`), porque cualquier planeta
    // puede recibir el bono.
    this.externalShieldVisual = new Graphics()
      .circle(0, 0, this.player.radius + 14)
      .fill({ color: 0xffc93c, alpha: 0.18 })
      .stroke({ width: 3, color: 0xffe08a, alpha: 0.75 });
    this.externalShieldVisual.visible = false;
    this.gameLayer.addChild(this.externalShieldVisual);

    // Aura genérica de "un compañero cercano te está ayudando" — pedido
    // explícito del usuario (2026-07-23, ver AGENTS.md §8.2): "las
    // habilidades debe de proteger al otro jugador... es como emular que se
    // ayudan juntas". Un solo tono neutro (no por planeta) para no sumar
    // más ruido visual a los aros/anillos ya existentes — ver `updateAllyAid()`.
    this.allyAidVisual = new Graphics()
      .circle(0, 0, this.player.radius + 20)
      .stroke({ width: 2, color: 0xaee8ff, alpha: 0.6 });
    this.allyAidVisual.visible = false;
    this.gameLayer.addChild(this.allyAidVisual);

    if (this.multiplayer) {
      this.localNameLabel = new Text({
        text: this.multiplayer.localDisplayName,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 15 * this.entityScale,
          fontWeight: "800",
          fill: 0x4d8dff,
          stroke: { color: 0x0b0e1f, width: 3 },
        },
      });
      this.localNameLabel.anchor.set(0.5, 1);
      this.gameLayer.addChild(this.localNameLabel);
    }

    if (this.planet === "venus") {
      // Escudo de gas ácido — ver AGENTS.md §5.
      this.venusShield = new Graphics()
        .circle(0, 0, this.player.radius + 14)
        .fill({ color: 0x9bff5c, alpha: 0.22 })
        .stroke({ width: 3, color: 0xb8ff7a, alpha: 0.7 });
      this.venusShield.visible = false;
      this.gameLayer.addChild(this.venusShield);
    } else if (this.planet === "jupiter") {
      // Aura gravitacional propia de Júpiter — tono ámbar/dorado (a
      // diferencia del verde ácido de Venus), coherente con la Gran
      // Mancha Roja/bandas doradas del planeta. Visible tanto en solitario
      // (único efecto de la habilidad ahí) como en multijugador (además
      // del bono de compañero, ver `tryShieldNearestAlly()`).
      this.jupiterShieldVisual = new Graphics()
        .circle(0, 0, this.player.radius + 14)
        .fill({ color: 0xffc93c, alpha: 0.18 })
        .stroke({ width: 3, color: 0xffe08a, alpha: 0.75 });
      this.jupiterShieldVisual.visible = false;
      this.gameLayer.addChild(this.jupiterShieldVisual);
    } else if (this.planet === "earth") {
      // Luna orbitando — ver AGENTS.md §5 (Hipervelocidad la acelera x15).
      this.earthMoon = new Graphics().circle(0, 0, 11).fill(0xe4e6f0).circle(-3, -3, 3).fill(0xb9bccc);
      this.gameLayer.addChild(this.earthMoon);
    } else if (this.planet === "saturn") {
      // Anillo defensivo — dos elipses aplanadas (como el anillo real del
      // planeta, ver components/characters/Saturn.tsx) en tonos plateado y
      // magenta (mismo morado que usa el repelido de asteroides más abajo,
      // `0xb35cff`) — gira sobre su eje y parpadea mientras está activo, ver
      // AGENTS.md §5 y `updateAbilityVisuals()`.
      this.saturnRingVisual = new Graphics()
        .ellipse(0, 0, this.player.radius + 30, this.player.radius + 12)
        .stroke({ width: 5, color: 0xd8dbe4, alpha: 0.9 })
        .ellipse(0, 0, this.player.radius + 22, this.player.radius + 8)
        .stroke({ width: 4, color: 0xb35cff, alpha: 0.85 });
      this.saturnRingVisual.visible = false;
      this.gameLayer.addChild(this.saturnRingVisual);
    } else if (this.planet === "neptune") {
      // Aura helada — visible siempre (no solo con la habilidad activa),
      // parpadea de forma continua (ver `updateAbilityVisuals()`). Tono
      // celeste/azul hielo, coherente con `engine/characterSvg.ts`.
      this.neptuneAuraVisual = new Graphics()
        .circle(0, 0, this.player.radius + 18)
        .stroke({ width: 3, color: 0x9fe8ff, alpha: 0.55 });
      this.gameLayer.addChild(this.neptuneAuraVisual);
    }

    this.input = new InputController(this.app.canvas);

    if (this.multiplayer) {
      for (const remote of this.multiplayer.initialRoster) {
        void this.addRemotePlayer(remote);
      }
      this.unsubscribers.push(
        this.multiplayer.onPositionUpdate((id, x, y) => {
          const remote = this.remotePlayers.get(id);
          if (remote) {
            remote.targetX = x;
            remote.targetY = y;
          }
        }),
        this.multiplayer.onPlayerJoined((info) => {
          void this.addRemotePlayer(info);
          // Re-avisa el bono de pulsares (si es Saturno) para que quien se
          // une después no se lo pierda — ver comentario de
          // `teamPulsarBoosts` arriba y AGENTS.md §8.2.
          if (this.ability.pulsarSpawnBoost > 0) {
            this.multiplayer?.sendPassiveBoost(this.ability.pulsarSpawnBoost);
          }
        }),
        this.multiplayer.onPlayerLeft((id) => {
          const remote = this.remotePlayers.get(id);
          if (remote) {
            this.gameLayer.removeChild(
              remote.sprite,
              remote.label,
              remote.faceOverlay.container,
              remote.deathSequence.container,
              remote.abilityIndicator,
            );
            // texture:false — `loadPlanetTexture()` usa el cache global de
            // PixiJS por planeta; otro jugador remoto (o el local) del
            // mismo planeta puede seguir usándola. Ver FieldObject.destroy().
            remote.sprite.destroy({ texture: false, textureSource: false });
            remote.label.destroy();
            remote.deathSequence.destroy();
            remote.abilityIndicator.destroy();
            this.remotePlayers.delete(id);
          }
          useGameStore.getState().removeTeammate(id);
          // No dejar su bono de pulsares "fantasma" aportando después de
          // que se fue — ver AGENTS.md §8.2.
          this.teamPulsarBoosts.delete(id);
        }),
        // Bono de compañero de Júpiter recibido — ver
        // `tryShieldNearestAlly()` arriba. Cura vidas de inmediato
        // (`abilityParams.jupiter.allyHealLives`, configurable por admin
        // desde 2026-07-24) y otorga invulnerabilidad temporal, sin importar
        // qué planeta esté jugando este cliente (Júpiter puede proteger a
        // cualquiera).
        this.multiplayer.onJupiterShielded((_fromDisplayName, durationMs) => {
          useGameStore
            .getState()
            .setLives(Math.min(MAX_LIVES, useGameStore.getState().lives + this.gameConfig.abilityParams.jupiter.allyHealLives));
          this.externalShieldMs = durationMs;
        }),
        // Reacción facial / secuencia de muerte de OTRO jugador — pedido
        // explícito del usuario (2026-07-22, ver AGENTS.md §5.1): "la
        // explosión y la frase épica también son vistas por los demás
        // jugadores". Se reproduce tal cual sobre SU sprite remoto, sin
        // tocar el estado local (`useGameStore`) de este cliente.
        this.multiplayer.onFaceReaction((id, expression) => {
          this.remotePlayers.get(id)?.faceOverlay.showExpression(expression);
        }),
        this.multiplayer.onPlayerDefeated((id, displayName, defeatPhrase) => {
          const remote = this.remotePlayers.get(id);
          if (!remote) return;
          remote.deathSequence.start();
          this.showFloatingPhrase(remote.sprite.x, remote.sprite.y - remote.sprite.height / 2 - 26, `${displayName}: "${defeatPhrase}"`);
        }),
        // Visibilidad de habilidad en equipo — pedido explícito del usuario
        // (2026-07-23, ver AGENTS.md §8): "se debe de ver tambien nuestra
        // habilidad en todas las sesiones".
        this.multiplayer.onAbilityState((id, active) => {
          const remote = this.remotePlayers.get(id);
          if (remote) remote.abilityActive = active;
          useGameStore.getState().setTeammate(id, { abilityActive: active });
        }),
        // Panel informativo de vidas/estrellas del equipo — nunca afecta la
        // física/colisiones de nadie, solo lo que se muestra en el panel.
        this.multiplayer.onPlayerStatus((id, lives, stars) => {
          useGameStore.getState().setTeammate(id, { lives, stars });
        }),
        // Nivel/marcador de agujeros negros compartido en equipo — pedido
        // explícito del usuario: "cuando del lado de un jugador sube un
        // nivel automaticamente sube de nivel todos en el equipo... es como
        // el marcador de cuantos agujeros negros hemos derrotado entre
        // todos". Nunca baja el nivel local, solo lo iguala o sube.
        this.multiplayer.onTeamProgress((_id, level) => {
          this.level = Math.max(this.level, level);
          useGameStore.getState().setLevel(this.level);
          const store = useGameStore.getState();
          store.setBlackHolesDefeatedTeam(store.blackHolesDefeatedTeam + 1);
        }),
        // Pasiva de pulsares de Saturno compartida con TODO el equipo — ver
        // AGENTS.md §8.2 y comentario del campo `teamPulsarBoosts` arriba.
        this.multiplayer.onPassiveBoost((id, pulsarSpawnBoost) => {
          this.teamPulsarBoosts.set(id, pulsarSpawnBoost);
        }),
      );

      // Le avisa al equipo su propio bono (si es Saturno) al montar, y de
      // nuevo cada vez que se une alguien nuevo — para que un jugador que
      // llega después de que Saturno ya estaba en la sala no se lo pierda.
      if (this.ability.pulsarSpawnBoost > 0) {
        this.multiplayer.sendPassiveBoost(this.ability.pulsarSpawnBoost);
      }
    }

    // Trazabilidad — ver comentario en destroy() más abajo. Este es el
    // momento exacto en que nivel/vidas de una partida en curso se pierden;
    // si `reason` alguna vez muestra más de un `mount` real (no solo el
    // primero de la sesión) sin que el jugador haya navegado, confirma un
    // remount inesperado del componente en vez de un game over real.
    clientLog("warn", "game.engine.reset", { planet: this.planet, initialStars: this.initialStars });
    useGameStore.getState().reset(this.initialStars);
    window.addEventListener("resize", this.handleResize);
    this.app.ticker.add(this.tick);

    // Música de fondo — ver engine/audio/backgroundMusic.ts y feedback real
    // del usuario (2026-07-22). El navegador puede crear el AudioContext
    // "suspended" sin un gesto previo; se reanuda en la primera tecla/click.
    // El gesto de "Jugar" en MusicPicker ya cuenta como ese primer gesto,
    // así que start()/loadCustomTrack() aquí ya suenan sin bloqueo.
    if (this.musicChoice?.type === "custom") {
      this.music.loadCustomTrack(this.musicChoice.file);
    } else {
      this.music.start(this.musicChoice?.type === "theme" ? this.musicChoice.themeIndex : undefined);
    }
    this.music.setMuted(useGameStore.getState().musicMuted);
    window.addEventListener("pointerdown", this.resumeMusicOnce, { once: true });
    window.addEventListener("keydown", this.resumeMusicOnce, { once: true });
  }

  private resumeMusicOnce = () => this.music.resume();

  private async addRemotePlayer(info: MultiplayerConfig["initialRoster"][number]) {
    const texture = await loadPlanetTexture(info.planet);
    if (this.destroyed || this.remotePlayers.has(info.id)) return;
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = 70 * this.entityScale;
    sprite.height = 70 * this.entityScale;
    sprite.alpha = 0.92;
    sprite.position.set(this.width / 2, this.height / 2);

    // Alias en gris delgado — el compañero ve el suyo propio en azul fuerte
    // (ver `localNameLabel` en mount()) y el de este jugador remoto así,
    // simétrico en cada cliente. Ver AGENTS.md §6.4.
    const label = new Text({
      text: info.displayName,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 13 * this.entityScale,
        fontWeight: "300",
        fill: 0x9ba3d4,
        stroke: { color: 0x0b0e1f, width: 2 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(sprite.x, sprite.y - sprite.height / 2 - 8);

    // Reacción facial / secuencia de muerte propias de este jugador remoto
    // — ver AGENTS.md §5.1. `sprite.width/2` como radio aproximado (mismo
    // criterio que `Player.radius`, ver entities/Player.ts).
    const faceOverlay = new FaceOverlay();
    const deathSequence = new DeathSequence(sprite, faceOverlay, this.explosionParticles, sprite.width / 2);

    // Indicador de habilidad activa — ver comentario del tipo de
    // `remotePlayers` arriba y AGENTS.md §8. Coloreado según SU planeta.
    const abilityIndicator = new Graphics()
      .circle(0, 0, sprite.width / 2 + 12)
      .stroke({ width: 4, color: ABILITY_INDICATOR_COLOR[info.planet], alpha: 0.85 });
    abilityIndicator.visible = false;

    this.gameLayer.addChild(sprite, label, faceOverlay.container, deathSequence.container, abilityIndicator);
    this.remotePlayers.set(info.id, {
      sprite,
      targetX: sprite.x,
      targetY: sprite.y,
      label,
      faceOverlay,
      deathSequence,
      abilityIndicator,
      abilityActive: false,
      planet: info.planet,
    });
    // Panel informativo de equipo (ver GameHud.tsx) — valores por defecto
    // hasta que llegue el primer `playerStatus` real de este compañero.
    useGameStore.getState().setTeammate(info.id, { displayName: info.displayName, planet: info.planet, lives: 10, stars: 0 });
  }

  /**
   * Frase épica de derrota de OTRO jugador, flotando sobre su sprite unos
   * segundos — pedido explícito del usuario (2026-07-22, ver AGENTS.md
   * §5.1). Lista corta y de vida corta, no amerita un `ParticlePool`
   * completo — se actualiza a mano en `tick()`.
   */
  private showFloatingPhrase(x: number, y: number, message: string, durationMs = 3200) {
    const text = new Text({
      text: message,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 13 * this.entityScale,
        fontWeight: "700",
        fill: 0xffe08a,
        stroke: { color: 0x2a1200, width: 3 },
        wordWrap: true,
        wordWrapWidth: 220,
        align: "center",
      },
    });
    text.anchor.set(0.5, 1);
    text.position.set(x, y);
    this.gameLayer.addChild(text);
    this.floatingTexts.push({ text, remainingMs: durationMs });
  }

  private handleResize = () => {
    this.width = this.app.screen.width;
    this.height = this.app.screen.height;
    this.background.resize(this.width, this.height);
  };

  /**
   * PC: Spacebar/clic — un solo control hace lo que corresponda según el
   * contexto (ataca el agujero negro si está activo, si no activa la
   * habilidad). En móvil esto se separó en dos botones distintos
   * (`attackBlackHole()`/`activateAbility()`) — ver GameHud.tsx y feedback
   * real del usuario (2026-07-22): "lo puso sobre el mismo botón que para
   * atacar al agujero negro, deben ser botones distintos".
   */
  handleActionPress() {
    if (this.isBlackHoleAttackable) {
      this.attackBlackHole();
      return;
    }
    this.activateAbility();
  }

  /**
   * `true` si hay algo que atacar ahora mismo: el Quasar activo, o (cuando
   * el Quasar sigue "idle") el agujero negro clásico/Nova objetivo — nunca
   * mientras el Quasar se está fusionando (ver AGENTS.md §5.1, pedido
   * explícito del usuario: "no podran derrotar a los agujeros negros sino
   * hasta que ya haya explotado y aparecido el quasar").
   */
  private get isBlackHoleAttackable(): boolean {
    if (this.quasar.phase === "active") return true;
    if (this.quasar.phase !== "idle") return false;
    return this.targetBlackHole.phase === "active";
  }

  /** Los dos agujeros negros del motor (clásico + Nova, nivel 60+) — ver AGENTS.md §5.1. */
  private get blackHoles(): BlackHole[] {
    return [this.blackHole, this.novaBlackHole];
  }

  /**
   * El agujero negro que debe recibir el próximo clic/tecla — pedido
   * explícito del usuario (2026-07-22, ver AGENTS.md §5.1): "si aparecen 2
   * agujeros negros, cada clic primero afecta al que haya aparecido
   * primero". Entre los que estén `active`, el de menor `activationOrder`
   * (asignado la primera vez que cada uno se activó, ver tick()). Si
   * ninguno está activo todavía, sirve de respaldo para el HUD/aviso.
   */
  private get targetBlackHole(): BlackHole {
    const active = this.blackHoles.filter((bh) => bh.phase === "active");
    if (active.length > 0) {
      return active.reduce((oldest, bh) => (bh.activationOrder < oldest.activationOrder ? bh : oldest));
    }
    if (this.novaBlackHole.phase === "warning" && this.blackHole.phase !== "warning") return this.novaBlackHole;
    return this.blackHole;
  }

  /** Botón flotante de habilidad (móvil) — nunca ataca al agujero negro. */
  activateAbility() {
    const activated = this.ability.activate();
    // Bono de compañero de Júpiter en multijugador — ver AGENTS.md §5 y
    // §15 (aclarado por el usuario 2026-07-22, implementado el mismo día
    // tras probarlo en vivo y no verlo funcionar). En solitario Júpiter
    // sigue comportándose exactamente igual que antes (solo escudo propio,
    // `this.ability.invulnerable` ya lo cubre sin tocar nada más aquí).
    if (activated && this.planet === "jupiter" && this.multiplayer) {
      this.tryShieldNearestAlly();
    }
  }

  /**
   * Busca al compañero remoto más cercano dentro de rango y le manda el
   * escudo — "escudo mutuo, vidas al protegido, estrellas a Júpiter" (ver
   * AGENTS.md §5/§9 — rango/vidas/estrellas configurables por admin desde
   * 2026-07-24, `game_config.abilityParams.jupiter`). Si no hay nadie
   * cerca, Júpiter igual activó su propio escudo (arriba) pero no hay bono
   * de compañero esta vez — coincide con "protege al PRIMER compañero que
   * se acerque", no un objetivo fijo.
   */
  private tryShieldNearestAlly() {
    if (!this.multiplayer) return;
    const { allyShieldRange, allyRewardStars } = this.gameConfig.abilityParams.jupiter;
    let nearestId: string | null = null;
    let nearestDist = Infinity;
    for (const [id, remote] of this.remotePlayers) {
      const dist = Math.hypot(remote.sprite.x - this.player.sprite.x, remote.sprite.y - this.player.sprite.y);
      if (dist < allyShieldRange && dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    }
    if (!nearestId) return;

    this.multiplayer.sendJupiterShield(nearestId, this.gameConfig.abilities.jupiter.durationMs);
    useGameStore.getState().addStars(allyRewardStars);
    this.checkAndCommitStars();
  }

  /**
   * Botón ✕ de salir de la partida (confirmado) — pedido explícito del
   * usuario (2026-07-23): "en el top 5 de equipos deben salir los planetas
   * del equipo completo". Bug real corregido: salir manualmente antes de
   * morir nunca reportaba el resultado (`reportSessionComplete()` solo se
   * llamaba al llegar a `gameStatus === "gameover"` en `tick()`), así que
   * ese jugador quedaba fuera de su propio historial Y del Top 5 de la
   * sala si el resto del equipo seguía jugando. Reutiliza el mismo reporte
   * (con guarda `sessionReported` — nunca se manda dos veces), con el
   * nivel/estrellas alcanzados hasta este momento.
   */
  reportManualExit() {
    const store = useGameStore.getState();
    this.reportSessionComplete(store.level, store.starsThisRun);
  }

  /** Botón flotante del agujero negro (móvil), solo visible mientras algo es atacable — ver `isBlackHoleAttackable`. */
  attackBlackHole() {
    // Quasar activo: el clic va ahí, no a los agujeros negros originales
    // (congelados/ocultos mientras el Quasar existe). El +1 de nivel/
    // marcador de equipo se aplica aparte, en `resetBlackHolesAfterQuasar()`
    // — disparado por `quasar.takeJustDefeated()` en tick() cuando termina
    // la animación de colapso, no en el instante del clic 25.
    if (this.quasar.phase === "active") {
      this.quasar.registerClick();
      return;
    }
    if (this.quasar.phase !== "idle") return; // fusionándose — nada es atacable todavía
    const bh = this.targetBlackHole;
    if (bh.phase !== "active") return;
    const defeated = bh.registerClick();
    if (defeated) {
      this.level += 1;
      useGameStore.getState().setLevel(this.level);
      // Nivel/marcador de agujeros negros compartido en equipo — pedido
      // explícito del usuario (2026-07-23, ver AGENTS.md §8): "cuando del
      // lado de un jugador sube un nivel automaticamente sube de nivel
      // todos en el equipo... es como el marcador de cuantos agujeros
      // negros hemos derrotado entre todos". El propio cliente que derrotó
      // el agujero negro se cuenta a sí mismo de inmediato (no espera su
      // propio mensaje de vuelta); los demás lo suman al recibir
      // `teamProgress` (ver `onTeamProgress` en mount()).
      if (this.multiplayer) {
        const store = useGameStore.getState();
        store.setBlackHolesDefeatedTeam(store.blackHolesDefeatedTeam + 1);
        this.multiplayer.sendTeamProgress(this.level);
      }
    }
  }

  /**
   * Al terminar la animación de colapso del Quasar (ver
   * `quasar.takeJustDefeated()` en tick()): sube de nivel/marcador de
   * equipo (misma lógica que derrotar un agujero negro normal, ver
   * `attackBlackHole()` arriba) y reinicia el clásico y el Nova a su ciclo
   * normal de espera, como si nunca se hubieran fusionado. Sube **2**
   * niveles (no 1) — pedido explícito del usuario (2026-07-24): "cuando se
   * derrota a un quasar vale por 2 niveles porque son 2 agujeros".
   */
  private resetBlackHolesAfterQuasar() {
    this.blackHole.reset();
    this.novaBlackHole.reset();
    this.level += 2;
    useGameStore.getState().setLevel(this.level);
    if (this.multiplayer) {
      const store = useGameStore.getState();
      store.setBlackHolesDefeatedTeam(store.blackHolesDefeatedTeam + 2);
      this.multiplayer.sendTeamProgress(this.level);
    }
  }

  private tick = () => {
    const deltaMS = Math.min(this.app.ticker.deltaMS, 48); // evita saltos grandes tras cambiar de pestaña
    const store = useGameStore.getState();
    if (store.gameStatus === "gameover") {
      this.reportSessionComplete(store.level, store.starsThisRun);
      return;
    }

    // Secuencia de muerte (2026-07-22, ver AGENTS.md §5.1) — "para que no
    // termine tan abrupto cuando te eliminan": el mundo del juego queda
    // congelado (sin spawns/colisiones/movimiento) mientras se reproduce la
    // animación; solo la explosión/textos flotantes de jugadores remotos
    // que ya murieron siguen animando.
    this.explosionParticles.update(deltaMS);
    this.updateFloatingTexts(deltaMS);
    if (store.gameStatus === "dying") {
      this.updateDeathSequence(deltaMS);
      return;
    }

    this.background.update(deltaMS, this.level);
    this.ability.update(deltaMS);
    // Visibilidad de habilidad en equipo — avisa solo al CAMBIAR de fase,
    // no en cada cuadro (ver AGENTS.md §8).
    if (this.multiplayer && this.ability.isActive !== this.lastAbilityActiveSent) {
      this.lastAbilityActiveSent = this.ability.isActive;
      this.multiplayer.sendAbilityState(this.lastAbilityActiveSent);
    }
    if (this.externalShieldMs > 0) this.externalShieldMs = Math.max(0, this.externalShieldMs - deltaMS);

    // Agujero Negro clásico + Nova: solo siguen su ciclo normal (aviso →
    // activo → clics) mientras el Quasar está "idle" — en cuanto ambos
    // están activos a la vez en un nivel válido, se congelan/ocultan y el
    // Quasar toma el control por completo (ver AGENTS.md §5.1 y
    // engine/entities/Quasar.ts). Pedido explícito del usuario (2026-07-24):
    // "no podran derrotar a los agujeros negros sino hasta que ya haya
    // explotado y aparecido el quasar".
    if (this.quasar.phase === "idle") {
      this.blackHole.update(deltaMS, this.level);
      if (this.blackHole.takeJustActivated()) this.blackHole.activationOrder = this.nextBlackHoleActivationOrder++;
      // Agujero Negro Nova — nivel configurable por admin (ver AGENTS.md
      // §5.1). Su `update()` solo se llama a partir de ese nivel; antes se
      // queda inerte/invisible (ver comentario arriba de esta clase).
      if (this.level >= this.gameConfig.novaBlackHole.minLevel) {
        this.novaBlackHole.update(deltaMS, this.level);
        if (this.novaBlackHole.takeJustActivated()) this.novaBlackHole.activationOrder = this.nextBlackHoleActivationOrder++;
      }
      if (
        this.level >= this.gameConfig.quasar.minLevel &&
        this.blackHole.phase === "active" &&
        this.novaBlackHole.phase === "active"
      ) {
        this.blackHole.container.visible = false;
        this.novaBlackHole.container.visible = false;
        this.quasar.begin(this.blackHole.x, this.blackHole.y, this.novaBlackHole.x, this.novaBlackHole.y);
      }
    }
    this.quasar.update(deltaMS);
    if (this.quasar.takeJustActivated()) this.spawnNeonBurst(this.quasar.x, this.quasar.y);
    if (this.quasar.takeJustDefeated()) this.resetBlackHolesAfterQuasar();

    const flareBurst = this.sun.update(deltaMS, this.level);
    if (flareBurst) {
      for (const dir of flareBurst.directions) {
        this.flareParticles.spawn(flareBurst.x, flareBurst.y, dir.vx, dir.vy, 2600);
      }
    }
    // Sol Rojo — nivel configurable por admin (ver AGENTS.md §5.1),
    // llamaradas imposibles de bloquear (ver `checkCollisions()`).
    if (this.level >= this.gameConfig.redSun.minLevel) {
      const redFlareBurst = this.redSun.update(deltaMS, this.level);
      if (redFlareBurst) {
        for (const dir of redFlareBurst.directions) {
          this.redFlareParticles.spawn(redFlareBurst.x, redFlareBurst.y, dir.vx, dir.vy, 2600);
        }
      }
    }
    // Constelaciones de los Caballeros del Zodiaco — nivel 40+, puramente
    // decorativas (ver AGENTS.md §4/§5.1). Mismo scroll que la capa "decor"
    // del fondo lejano (`getBackgroundSpeedMultiplier()`, compartida con
    // ParallaxBackground.update() para que ambas capas avancen igual de
    // rápido siempre) — pedido explícito del usuario (2026-07-22): "cuando
    // aparecen las constelaciones zodiacales... la velocidad del fondo
    // debería ser mucho más rápido para dar la apariencia de un nivel
    // mucho más alto".
    if (this.level >= ZODIAC_LEVEL) {
      this.zodiacLayer.container.visible = true;
      this.zodiacLayer.update(deltaMS, 22 * getBackgroundSpeedMultiplier(this.level));
    }

    this.flareParticles.update(deltaMS);
    this.redFlareParticles.update(deltaMS);
    this.lavaParticles.update(deltaMS);
    this.absorbParticles.update(deltaMS);
    this.trailParticles.update(deltaMS);
    this.iceShatterParticles.update(deltaMS);
    this.rockShatterParticles.update(deltaMS);
    this.dustParticles.update(deltaMS);
    this.auroraParticles.update(deltaMS);
    this.neonDustParticles.update(deltaMS);

    this.updateSpawns(deltaMS);
    this.updateFieldObjects(deltaMS);

    // Ver InputController.getMovement: clicar sobre un Agujero Negro para
    // atacarlo (instinto natural) ya no camina al jugador adentro de él —
    // ahora se recorta contra CUALQUIER agujero negro activo (pueden ser
    // dos a la vez desde el nivel 60, ver AGENTS.md §5.1).
    const dangerZones = this.blackHoles
      .filter((bh) => bh.phase === "active")
      .map((bh) => ({ x: bh.x, y: bh.y, radius: bh.radius + this.player.radius + 30 }));
    // El Quasar también recorta el punto-objetivo del cursor, con su radio
    // de atracción más grande (ver AGENTS.md §5.1) — mismo motivo que los
    // agujeros negros arriba.
    if (this.quasar.phase === "active") {
      dangerZones.push({ x: this.quasar.x, y: this.quasar.y, radius: this.quasar.attractionRadius * 0.3 + this.player.radius });
    }
    const { dx, dy } = this.input.getMovement(this.player.sprite.x, this.player.sprite.y, dangerZones);
    this.player.update(
      deltaMS,
      dx,
      dy,
      this.ability.isActive ? this.ability.speedMultiplier : 1,
      // Velocidad individual por planeta, configurable por admin
      // (game_config.player.baseSpeedByPlanet, 2026-07-22, pedido explícito
      // del usuario) — antes un único valor global, y antes de eso la
      // constante fija `BASE_PLAYER_SPEED`, ver AGENTS.md §5. Multiplicada
      // por `playerPaceMultiplier` (2x en PC/laptop, prueba explícita del
      // usuario tras un primer ajuste que la dejaba intacta — ver su
      // comentario en el campo).
      this.gameConfig.player.baseSpeedByPlanet[this.planet] * this.playerPaceMultiplier,
    );
    if (this.localNameLabel) {
      this.localNameLabel.position.set(this.player.sprite.x, this.player.sprite.y - this.player.radius - 8);
    }
    // Reacciones faciales chistosas — ver AGENTS.md §5.1 y FaceOverlay.ts.
    this.faceOverlay.update(deltaMS);
    this.faceOverlay.container.position.set(this.player.sprite.x, this.player.sprite.y);
    this.faceOverlay.container.scale.set(this.entityScale);
    this.applyBlackHolePlayerPull(deltaMS);
    this.updateAbilityBar();
    this.updateAbilityVisuals(deltaMS);

    this.checkCollisions();
    this.updateMultiplayer(deltaMS);

    this.hudSyncTimer += deltaMS;
    if (this.hudSyncTimer >= HUD_SYNC_INTERVAL_MS) {
      this.hudSyncTimer = 0;
      store.setAbility(this.ability.phase, this.ability.progress);
      // El HUD refleja el hazard "objetivo" (el que recibirá el próximo
      // clic/tecla) — el Quasar activo tiene prioridad; mientras se está
      // fusionando, nada es atacable todavía (se reporta como "warning"
      // para que el botón/alerta de ataque no aparezcan) — ver
      // `isBlackHoleAttackable` y AGENTS.md §5.1.
      if (this.quasar.phase === "active") {
        store.setBlackHole("active", this.quasar.clicksRemaining, this.quasar.clicksRequired, true);
      } else if (this.quasar.phase !== "idle") {
        store.setBlackHole("warning", 0, 1, false);
      } else {
        const target = this.targetBlackHole;
        store.setBlackHole(target.phase, target.clicksRemaining, target.clicksRequired, false);
      }
    }
  };

  private updateMultiplayer(deltaMS: number) {
    if (!this.multiplayer) {
      // Sin multijugador no hay compañeros de quien recibir ayuda — se deja
      // en el estado neutro (por si alguna vez se llamó a mount() con un
      // planeta que sí tenía un allyAid activo de una partida anterior, no
      // debería pasar, pero es una guarda barata).
      this.allyAid = { ...NEUTRAL_ALLY_AID };
      this.teamStormActive = false;
      return;
    }

    // Ayuda entre compañeros (ver AGENTS.md §8.2 y `mergeAllyAid()` arriba)
    // — se recalcula desde cero cada cuadro a partir de la posición (ya
    // interpolada más abajo) y el `abilityActive` de cada compañero, ambos
    // ya sincronizados por red; no hace falta ningún mensaje nuevo.
    const aid: AllyAidState = { ...NEUTRAL_ALLY_AID };
    for (const remote of this.remotePlayers.values()) {
      if (remote.abilityActive) {
        const dist = Math.hypot(remote.sprite.x - this.player.sprite.x, remote.sprite.y - this.player.sprite.y);
        if (dist < ALLY_AID_RANGE) mergeAllyAid(aid, remote.planet);
      }
    }
    this.allyAid = aid;
    // Tormenta de Neptuno de sala completa — ver comentario del campo
    // arriba y AGENTS.md §8.2. Sin chequeo de distancia a propósito.
    this.teamStormActive = [...this.remotePlayers.values()].some((r) => r.planet === "neptune" && r.abilityActive);

    for (const remote of this.remotePlayers.values()) {
      if (remote.deathSequence.active) {
        // Reproduciendo SU secuencia de muerte (ver AGENTS.md §5.1) — deja
        // de interpolar hacia la posición de red mientras dura (el sprite
        // ya lo controla DeathSequence: tinte/vibración/explosión).
        remote.deathSequence.update(deltaMS);
        remote.label.visible = false;
      } else {
        // Interpola cada jugador remoto hacia la última posición recibida —
        // suaviza la red en vez de "teletransportar" en cada paquete.
        remote.sprite.x += (remote.targetX - remote.sprite.x) * 0.25;
        remote.sprite.y += (remote.targetY - remote.sprite.y) * 0.25;
        remote.label.position.set(remote.sprite.x, remote.sprite.y - remote.sprite.height / 2 - 8);
      }
      remote.faceOverlay.update(deltaMS);
      remote.faceOverlay.container.position.set(remote.sprite.x, remote.sprite.y);
      remote.faceOverlay.container.scale.set(this.entityScale);

      // Indicador de habilidad activa — ver AGENTS.md §8.
      remote.abilityIndicator.position.set(remote.sprite.x, remote.sprite.y);
      remote.abilityIndicator.visible = remote.abilityActive;
      if (remote.abilityActive) {
        remote.abilityIndicator.alpha = 0.5 + 0.5 * Math.abs(Math.sin(this.slowfieldBlinkTimer * 0.02));
      }
    }

    // ~20 mensajes/s — ver AGENTS.md §8.
    this.posSyncTimer += deltaMS;
    if (this.posSyncTimer >= 50) {
      this.posSyncTimer = 0;
      this.multiplayer.sendPosition(this.player.sprite.x, this.player.sprite.y);
    }

    // Panel informativo de vidas/estrellas del equipo (~1 msg/s, ver
    // AGENTS.md §8 y GameHud.tsx) — pedido explícito del usuario: "puedas
    // ver las vidas y estrellas que tiene cada jugador como informativo".
    this.statusSyncTimer += deltaMS;
    if (this.statusSyncTimer >= 1000) {
      this.statusSyncTimer = 0;
      const store = useGameStore.getState();
      this.multiplayer.sendPlayerStatus(store.lives, store.initialStars + store.starsThisRun);
    }
  }

  private updateSpawns(deltaMS: number) {
    this.asteroidTimer -= deltaMS;
    if (this.asteroidTimer <= 0) {
      // Antes se topaba en ~300ms desde el nivel 13 en adelante — a partir
      // de ahí, subir de nivel ya no aumentaba la cantidad de asteroides en
      // pantalla, solo su velocidad. Feedback real del usuario (2026-07-22,
      // nivel 30): "llegó un punto en donde casi no pasaban asteroides".
      // Ahora sigue bajando gradualmente hasta un piso mucho más tardío.
      const baseInterval = (Math.max(120, 700 - this.level * 10) + this.rng() * 350) / this.paceScale;
      // Efecto propio del Agujero Negro Nova (nivel 60+, ver AGENTS.md
      // §5.1): "provocará que la frecuencia de las rocas sea 3 veces más"
      // mientras está activo.
      this.asteroidTimer = this.novaBlackHole.triplesAsteroidSpawn ? baseInterval / 3 : baseInterval;
      const asteroid = spawnAsteroid(this.textures, this.width, this.height, this.level, this.rng, this.entityScale, this.paceScale);
      this.fieldObjects.push(asteroid);
      this.gameLayer.addChild(asteroid.sprite);
    }

    this.pulsarTimer -= deltaMS;
    if (this.pulsarTimer <= 0) {
      // Frecuencia base configurable por admin (game_config.pulsars) — ver
      // AGENTS.md §9. Saturno (pasiva, ver saturnAbility.ts) acorta el
      // intervalo un `pulsarSpawnBoost` (+30% en solitario, el doble en
      // equipo — pedido explícito del usuario 2026-07-22). Si hay un
      // Saturno EN EL EQUIPO (`teamPulsarBoosts`, ver AGENTS.md §8.2 —
      // pedido explícito del usuario: "a todos los integrantes de la sala
      // les comparte esa habilidad pasiva"), su bono aplica también a los
      // demás jugadores, no solo a la sesión de Saturno.
      const teamBoost = Math.max(0, ...this.teamPulsarBoosts.values());
      const effectiveBoost = Math.max(this.ability.pulsarSpawnBoost, teamBoost);
      this.pulsarTimer = (this.gameConfig.pulsars.spawnFrequencyMs + this.rng() * 3200) * (1 - effectiveBoost);
      const pulsar = spawnPulsar(this.textures, this.width, this.height, this.rng() < 0.35, this.rng, this.entityScale);
      this.fieldObjects.push(pulsar);
      this.gameLayer.addChild(pulsar.sprite);
    }

    this.starTimer -= deltaMS;
    if (this.starTimer <= 0) {
      // Frecuencia base configurable por admin (game_config.stars) — ver AGENTS.md §9.
      this.starTimer = this.gameConfig.stars.spawnFrequencyMs + this.rng() * 2200;
      const star = spawnStar(this.textures, this.width, this.height, this.rng, this.entityScale);
      this.fieldObjects.push(star);
      this.gameLayer.addChild(star.sprite);
    }
  }

  private updateFieldObjects(deltaMS: number) {
    // Ambos agujeros negros activos atraen/"devoran" asteroides a la vez
    // desde el nivel 60 (ver AGENTS.md §5.1) — cada asteroide solo puede
    // ser arrastrado por UNO por cuadro (el primero que lo alcance en este
    // orden), para no sumar dos tirones sobre el mismo objeto. El Quasar
    // (nivel 55+ configurable) se suma a la misma lista de atractores con
    // su propio radio/fuerza — pedido explícito del usuario: "tiene también
    // más fuerte atracción... es más grande su circunferencia de atracción".
    const attractors: { x: number; y: number; attractionRadius: number }[] = this.blackHoles
      .filter((bh) => bh.phase === "active")
      .map((bh) => ({ x: bh.x, y: bh.y, attractionRadius: bh.radius * 5 }));
    if (this.quasar.phase === "active") {
      attractors.push({ x: this.quasar.x, y: this.quasar.y, attractionRadius: this.quasar.attractionRadius });
    }
    this.slowfieldBlinkTimer += deltaMS;

    for (let i = this.fieldObjects.length - 1; i >= 0; i--) {
      const obj = this.fieldObjects[i];

      let attractedByBlackHole = false;
      if (obj.kind === "asteroid") {
        for (const bh of attractors) {
          const attractionRadius = bh.attractionRadius;
          const distX = obj.sprite.x - bh.x;
          const distY = obj.sprite.y - bh.y;
          const dist = Math.hypot(distX, distY);
          if (dist < attractionRadius) {
            attractedByBlackHole = true;
            // Consumo en espiral — ver AGENTS.md §4 y §5.1 ("tragárselas").
            const angle = Math.atan2(distY, distX) + deltaMS * 0.006;
            const newDist = Math.max(0, dist - deltaMS * 0.25);
            obj.sprite.x = bh.x + Math.cos(angle) * newDist;
            obj.sprite.y = bh.y + Math.sin(angle) * newDist;
            obj.sprite.scale.set(Math.max(0.05, newDist / (attractionRadius * 0.6)));
            if (newDist < 10) {
              this.absorbParticles.spawn(obj.sprite.x, obj.sprite.y, 0, 0, 380, 1.4);
              this.gameLayer.removeChild(obj.sprite);
              obj.destroy();
              this.fieldObjects.splice(i, 1);
            }
            break;
          }
        }
      }
      if (attractedByBlackHole) continue;

      let speedFactor = 1;
      if (obj.kind === "asteroid") {
        const dist = Math.hypot(obj.sprite.x - this.player.sprite.x, obj.sprite.y - this.player.sprite.y);
        // Campo de distorsión propio (Mercurio) O de un compañero Mercurio
        // cercano con su habilidad activa (`this.allyAid.slowfieldRadius`,
        // ver AGENTS.md §8.2: "la distorsión temporal de Mercurio también
        // protege"). Si ambos aplican a la vez, gana el factor más fuerte.
        let slowed = false;
        // Congelado por Neptuno específicamente (pasiva/activa propia o
        // tormenta de equipo) — pedido explícito del usuario (2026-07-23):
        // "cuando neptuno active su habilidad activa... que sea de su
        // propio color un azul como con nieve y hielo" (distinto del cian
        // genérico de Mercurio). También marca `obj.frozen` para la
        // animación de añicos de hielo al destruirlo (ver checkCollisions()).
        let iceSlowed = false;
        if (this.ability.isActive && dist < this.ability.slowfieldRadius) {
          speedFactor = Math.min(speedFactor, this.ability.slowfieldFactor);
          slowed = true;
          if (this.planet === "neptune") iceSlowed = true;
        }
        if (this.allyAid.slowfieldRadius > 0 && dist < this.allyAid.slowfieldRadius) {
          speedFactor = Math.min(speedFactor, this.allyAid.slowfieldFactor);
          slowed = true; // siempre de Mercurio — el único que aporta esto en mergeAllyAid()
        }
        // "Aura Helada" de Neptuno — pasiva SIEMPRE activa (no depende de
        // `isActive`, a diferencia del campo de arriba) — ver AGENTS.md §5
        // y engine/abilities/neptuneAbility.ts.
        if (this.ability.passiveSlowfieldRadius > 0 && dist < this.ability.passiveSlowfieldRadius) {
          speedFactor = Math.min(speedFactor, this.ability.passiveSlowfieldFactor);
          slowed = true;
          iceSlowed = true;
        }
        // Tormenta de Neptuno sentida en TODA la sala mientras un
        // compañero Neptuno la tiene activa — pedido explícito del usuario
        // (2026-07-23, ver AGENTS.md §8.2): la parte que justifica que sea
        // el planeta más caro. Más leve que el congelamiento propio de
        // Neptuno, y sin chequeo de distancia A NEPTUNO (solo al jugador
        // local) — la tormenta "cubre" a todo el equipo, no solo a quien
        // esté cerca de él.
        if (this.teamStormActive && dist < 220) {
          speedFactor = Math.min(speedFactor, 0.35);
          slowed = true;
          iceSlowed = true;
        }
        obj.frozen = iceSlowed;
        // Pasiva de Venus (2026-07-24) — "los asteroides pequeños que se
        // acerquen a venus cambian a un color rojo como si se quemaran".
        // Solo asteroides chicos, solo mientras se acercan a Venus; el
        // destino real (destruirse en polvo, sin dañar a Venus) se resuelve
        // en checkCollisions().
        const venusHeated =
          this.ability.smallAsteroidImmune && obj.radius < SMALL_ASTEROID_RADIUS * this.entityScale && dist < VENUS_HEAT_RANGE;
        if (slowed) {
          // Azul hielo/nieve propio de Neptuno (mismo tono que
          // `ABILITY_INDICATOR_COLOR.neptune`/`--neptune-glow`) vs. el cian
          // genérico de Mercurio — pedido explícito del usuario (2026-07-23).
          obj.sprite.tint = iceSlowed ? 0x5ec8ff : 0x8ff5ff;
          // Parpadeo visible del campo de distorsión gravitatoria — antes
          // solo se veía el tinte, poco notorio; feedback real del usuario
          // (2026-07-22).
          obj.sprite.alpha = 0.5 + 0.5 * Math.abs(Math.sin(this.slowfieldBlinkTimer * 0.012));
        } else if (venusHeated) {
          obj.sprite.tint = 0xff4d2e; // rojo ardiente, "como si se quemaran"
          obj.sprite.alpha = 0.65 + 0.35 * Math.abs(Math.sin(this.slowfieldBlinkTimer * 0.02));
        } else {
          obj.sprite.tint = 0xffffff;
          obj.sprite.alpha = 1;
        }
      }

      // Anillos de Saturno (propios o de un compañero Saturno cercano con
      // su habilidad activa, `this.allyAid.ringRepelActive` — ver AGENTS.md
      // §8.2) — repelen asteroides cercanos (ver AGENTS.md §5 y
      // engine/abilities/saturnAbility.ts). Rediseñado (2026-07-23) — pedido
      // explícito del usuario: "aunque vayan rapidos deben de disminuir su
      // velocidad y desviar la trayectoria del asteroide para que no lo
      // toquen". Antes solo empujaba la POSICIÓN un poco cada cuadro sin
      // tocar `vx`/`vy` — un asteroide rápido retomaba su rumbo original al
      // siguiente cuadro, así que el empuje nunca alcanzaba a desviarlo a
      // tiempo. Ahora también reduce su velocidad (mismo criterio que el
      // campo de Mercurio, le da más cuadros dentro del radio para
      // reaccionar) y gira su vector de velocidad hacia afuera del jugador
      // de forma permanente, más fuerte mientras más cerca esté.
      if ((this.ability.ringRepelActive || this.allyAid.ringRepelActive) && obj.kind === "asteroid") {
        const dx = obj.sprite.x - this.player.sprite.x;
        const dy = obj.sprite.y - this.player.sprite.y;
        const dist = Math.hypot(dx, dy);
        // Configurable por admin desde 2026-07-24 — ver AGENTS.md §9.
        const repelRadius = this.gameConfig.abilityParams.saturn.ringRepelRadius;
        if (dist < repelRadius && dist > 1) {
          const proximity = 1 - dist / repelRadius;
          speedFactor = Math.min(speedFactor, 0.5);
          const nx = dx / dist;
          const ny = dy / dist;
          const speedMag = Math.hypot(obj.vx, obj.vy);
          const steer = Math.min(1, proximity * 8 * (deltaMS / 1000));
          obj.vx = obj.vx * (1 - steer) + nx * speedMag * steer;
          obj.vy = obj.vy * (1 - steer) + ny * speedMag * steer;
          obj.sprite.tint = 0xb35cff;
        }
      }

      obj.update(deltaMS, speedFactor);

      if (obj.isOffscreen(this.width, this.height)) {
        this.gameLayer.removeChild(obj.sprite);
        obj.destroy();
        this.fieldObjects.splice(i, 1);
      }
    }
  }

  private updateAbilityBar() {
    this.abilityBar.position.set(this.player.sprite.x, this.player.sprite.y + this.player.radius + 14);
    const color = this.ability.phase === "ready" ? 0x4dffb8 : this.ability.phase === "active" ? 0xff5cd6 : 0x8a8fb8;
    const fraction = this.ability.phase === "ready" ? 1 : this.ability.progress;
    this.abilityBarFill.clear().roundRect(-30, -4, Math.max(2, 60 * fraction), 8, 4).fill(color);
  }

  private updateAbilityVisuals(deltaMS: number) {
    const p = this.player.sprite;

    if (this.venusShield) {
      this.venusShield.position.set(p.x, p.y);
      this.venusShield.visible = this.ability.invulnerable;
    }

    if (this.jupiterShieldVisual) {
      this.jupiterShieldVisual.position.set(p.x, p.y);
      this.jupiterShieldVisual.visible = this.ability.invulnerable;
    }

    // Protegido por el bono de compañero de Júpiter — ver comentario del
    // campo arriba y AGENTS.md §5/§8. Independiente del planeta local.
    this.externalShieldVisual.position.set(p.x, p.y);
    this.externalShieldVisual.visible = this.externalShieldMs > 0;

    // Aura genérica de ayuda entre compañeros — ver AGENTS.md §8.2 y
    // comentario del campo arriba. Visible mientras CUALQUIER efecto de
    // `this.allyAid` esté activo (recalculado cada cuadro).
    const hasAllyAid =
      this.allyAid.invulnerable || this.allyAid.redFlareImmune || this.allyAid.ringRepelActive || this.allyAid.slowfieldRadius > 0 || this.allyAid.destroyRadius > 0;
    this.allyAidVisual.position.set(p.x, p.y);
    this.allyAidVisual.visible = hasAllyAid;

    if (this.saturnRingVisual) {
      this.saturnRingVisual.position.set(p.x, p.y);
      this.saturnRingVisual.visible = this.ability.ringRepelActive;
      if (this.ability.ringRepelActive) {
        // Gira rápido sobre su propio eje y parpadea — pedido explícito del
        // usuario (2026-07-22): "su anillo empieza a girar parpadeando y
        // girando rapidamente en todos lados para defender". Reutiliza
        // `slowfieldBlinkTimer` (se acumula cada cuadro sin importar el
        // planeta, ver `updateFieldObjects()`) para el parpadeo.
        this.saturnRingVisual.rotation += deltaMS * 0.012;
        this.saturnRingVisual.alpha = 0.55 + 0.45 * Math.abs(Math.sin(this.slowfieldBlinkTimer * 0.02));
      }
    }

    if (this.neptuneAuraVisual) {
      // Siempre visible, parpadea todo el tiempo — pedido explícito del
      // usuario: "quiero un diseño muy bonito y que brille y parpadee". Se
      // intensifica y agranda mientras la Tormenta de Neptuno está activa.
      this.neptuneAuraVisual.position.set(p.x, p.y);
      const boosted = this.ability.isActive;
      this.neptuneAuraVisual.scale.set(boosted ? 1.35 : 1);
      this.neptuneAuraVisual.alpha = (boosted ? 0.75 : 0.4) + 0.35 * Math.abs(Math.sin(this.slowfieldBlinkTimer * 0.015));
    }

    if (this.earthMoon) {
      // Configurable por admin (game_config.earthMoon.baseSpeed, 2026-07-22,
      // pedido explícito del usuario) — antes constante fija, ver AGENTS.md §5.
      this.earthMoonAngle += this.gameConfig.earthMoon.baseSpeed * this.ability.moonSpeedMultiplier * (deltaMS / 1000);
      this.earthMoon.position.set(
        p.x + Math.cos(this.earthMoonAngle) * EARTH_MOON_ORBIT_RADIUS,
        p.y + Math.sin(this.earthMoonAngle) * EARTH_MOON_ORBIT_RADIUS,
      );
    }

    if (this.ability.lavaBurstActive) {
      this.marsLavaBurstTimer -= deltaMS;
      if (this.marsLavaBurstTimer <= 0) {
        this.marsLavaBurstTimer = 140;
        const rays = 10;
        for (let i = 0; i < rays; i++) {
          const angle = (i / rays) * Math.PI * 2;
          const speed = this.gameConfig.abilityParams.mars.lavaRange / 0.4; // recorre el rango corto en ~0.4s
          this.lavaParticles.spawn(p.x, p.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 400);
        }
      }
    }

    // Rastro de luz de Mercurio en súper-velocidad — pedido real del
    // usuario (2026-07-22, faltaba). Destellos que se quedan flotando
    // brevemente en el camino recorrido, tipo flash.
    if (this.planet === "mercury" && this.ability.isActive) {
      this.mercuryTrailTimer -= deltaMS;
      if (this.mercuryTrailTimer <= 0) {
        this.mercuryTrailTimer = 35;
        this.trailParticles.spawn(p.x, p.y, 0, 0, 260, 0.9 + this.rng() * 0.3);
      }
    }
  }

  private applyBlackHolePlayerPull(deltaMS: number) {
    // Ambos agujeros negros activos tiran del jugador a la vez desde el
    // nivel 60 (ver AGENTS.md §5.1) — cada uno aplica su propia fuerza,
    // que se suman naturalmente (applyExternalForce acumula posición).
    for (const bh of this.blackHoles) {
      if (bh.phase !== "active") continue;
      const dx = bh.x - this.player.sprite.x;
      const dy = bh.y - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      const pullRadius = bh.radius * 6;
      if (dist < pullRadius && dist > 1) {
        // Atracción leve, más fuerte cerca del núcleo — ver PROMPT.md (debe dar
        // tiempo de escapar). `attractionForce` configurable por admin (game_config.blackHole).
        const strength = (1 - dist / pullRadius) * 90 * bh.attractionForce;
        this.player.applyExternalForce((dx / dist) * strength, (dy / dist) * strength, deltaMS);
      }
    }
    // El Quasar también atrae al jugador — mismo mecanismo de arriba, con
    // el radio de `quasar.attractionRadius` directo (ya coincide con el
    // anillo visual más externo, ver Quasar.ts — sin multiplicador extra,
    // pedido explícito del usuario: "que este a la altura de sus anillos").
    if (this.quasar.phase === "active") {
      const dx = this.quasar.x - this.player.sprite.x;
      const dy = this.quasar.y - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      const pullRadius = this.quasar.attractionRadius;
      if (dist < pullRadius && dist > 1) {
        const strength = (1 - dist / pullRadius) * 90 * this.quasar.attractionForce;
        this.player.applyExternalForce((dx / dist) * strength, (dy / dist) * strength, deltaMS);
      }
    }
  }

  /**
   * Ráfaga de fragmentos angulosos volando en todas direcciones al destruir
   * un asteroide — pedido explícito del usuario (2026-07-23): "se rompen en
   * cachitos... para que se vea mas epico". `pool` decide el material (hielo
   * vs. roca, ver ParticlePool.ts).
   */
  private spawnShatterBurst(pool: ParticlePool, x: number, y: number, count = 7) {
    // `Math.random()` a propósito, NUNCA `this.rng()` — es puramente visual
    // local (mismo criterio que DeathSequence.ts), consumir del generador
    // COMPARTIDO aquí desincronizaría el mundo entre clientes en
    // multijugador (ver RETROSPECTIVA.md, regla de RNG compartido).
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const speed = 90 + Math.random() * 110;
      pool.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 420 + Math.random() * 200, 0.8 + Math.random() * 0.6);
    }
  }

  /**
   * Nube de polvo al desintegrar un asteroide pequeño contra Venus — pedido
   * explícito del usuario (2026-07-24): "al chocar con venus se vuelven
   * polvo... una pequeña animacion de polvo en donde impactaron". Mismo
   * criterio de `Math.random()` que `spawnShatterBurst` — puramente visual
   * local, nunca `this.rng()`.
   */
  private spawnDustBurst(x: number, y: number, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 70;
      this.dustParticles.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 500 + Math.random() * 250, 0.7 + Math.random() * 0.5);
    }
  }

  /**
   * Aurora boreal al impactar el campo magnético de la Tierra — pedido
   * explícito del usuario (2026-07-24): "cada vez que lo impactan... provoca
   * una pequeña animacion de aurora boreal donde lo impacto". Mismo
   * criterio de `Math.random()` que `spawnShatterBurst`.
   */
  private spawnAuroraBurst(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      this.auroraParticles.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 700 + Math.random() * 300, 0.8 + Math.random() * 0.6);
    }
  }

  /**
   * Explosión de polvo de colores neón justo cuando el clásico y el Nova
   * terminan de fusionarse y aparece el Quasar — pedido explícito del
   * usuario (2026-07-24): "que se vea como una explosion de colores neon
   * como polvo de colores y despues aparezca la supernova". Ráfaga más
   * grande/dramática que el resto (evento único, no un efecto continuo).
   * `Math.random()` a propósito, mismo criterio que `spawnShatterBurst`.
   */
  private spawnNeonBurst(x: number, y: number, count = 26) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 60 + Math.random() * 180;
      this.neonDustParticles.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 900 + Math.random() * 500, 0.8 + Math.random() * 0.8);
    }
  }

  private checkCollisions() {
    const store = useGameStore.getState();
    const p = this.player.sprite;
    // Venus / Júpiter propio (this.ability.invulnerable), el bono de
    // compañero de Júpiter (externalShieldMs) O un compañero Venus cercano
    // con su escudo activo (this.allyAid.invulnerable — ver AGENTS.md §8.2
    // y `mergeAllyAid()`).
    const shielded = this.ability.invulnerable || this.externalShieldMs > 0 || this.allyAid.invulnerable;
    // Mercurio a súper-velocidad — pedido explícito del usuario (2026-07-23):
    // "como su velocidad es muy rapida cuando tienes su habilidad activa los
    // asteroides no lo afectan y al contrario el es el que destruye los
    // asteroides que toca el". A diferencia del escudo de Venus (que
    // protege pero deja pasar el asteroide intacto), Mercurio los destruye
    // al tocarlos. Neptuno comparte el mismo mecanismo mientras su Tormenta
    // está activa — "se hace añicos" cualquier asteroide congelado que lo
    // toque, ver engine/abilities/neptuneAbility.ts. Ver el bucle de
    // colisión directa más abajo.
    const destroysAsteroidsOnTouch =
      (this.planet === "mercury" || this.planet === "neptune") && this.ability.isActive;

    // Núcleo de cualquiera de los agujeros negros activos (pueden ser dos
    // desde el nivel 60, ver AGENTS.md §5.1) — un solo golpe por cuadro,
    // aunque el jugador esté tocando ambos núcleos a la vez.
    if (!shielded) {
      let hitCore = false;
      for (const bh of this.blackHoles) {
        if (bh.phase === "active" && circlesOverlap(p.x, p.y, 0, bh.x, bh.y, bh.radius * 0.6) && this.player.hit()) {
          this.applyDamage(2);
          hitCore = true;
          break;
        }
      }
      if (
        !hitCore &&
        this.quasar.phase === "active" &&
        circlesOverlap(p.x, p.y, 0, this.quasar.x, this.quasar.y, this.quasar.radius * 0.6) &&
        this.player.hit()
      ) {
        this.applyDamage(2);
      }
    }

    // Haz de luz del Quasar (nivel 55+, ver AGENTS.md §5.1) — CONSTANTE y
    // giratorio mientras el Quasar está activo, pedido explícito del
    // usuario (2026-07-24): "esos rayos que sacan son constantes... si
    // toca a los planetas les quita 2 vidas, nadie tiene defensa contra
    // eso" — nunca bloqueado por ningún escudo/inmunidad (mismo criterio
    // que las llamaradas del Sol Rojo).
    if (this.quasar.distanceToBeam(p.x, p.y) < this.player.radius && this.player.hit()) {
      this.applyDamage(this.gameConfig.quasar.rayDamageLives);
    }

    // Llamaradas del Sol Rojo (nivel 45+) — normalmente NUNCA bloqueadas por
    // ningún escudo/inmunidad (ni Venus, ni Júpiter propio/de compañero, ni
    // la pasiva de Mercurio) — pedido explícito del usuario, ver AGENTS.md
    // §5.1. Únicas excepciones: los anillos activos de Saturno
    // (`redFlareImmune`, pedido explícito del usuario 2026-07-22: "es el
    // unico que cuando su habilidad esta activa es el unico que tiene
    // defensa del sol rojo") y un compañero Saturno cercano con su
    // habilidad activa (`this.allyAid.redFlareImmune`, ver AGENTS.md §8.2).
    if (!this.ability.redFlareImmune && !this.allyAid.redFlareImmune) {
      this.redFlareParticles.forEachActive((x, y, deactivate) => {
        if (circlesOverlap(x, y, 0, p.x, p.y, this.player.radius + 12) && this.player.hit()) {
          this.applyDamage(1);
          deactivate();
        }
      });
    }

    // Llamaradas del Sol amarillo. Mercurio (pasiva) y Venus (escudo activo)
    // son inmunes de forma "silenciosa" — la llamarada ni se detecta ni se
    // desactiva, sigue de largo (comportamiento ya shipeado, sin cambios).
    // La Tierra (pasiva nueva, 2026-07-24) SÍ detecta y consume la llamarada
    // pero sin daño — "cada vez que lo impactan aunque no le hacen nada
    // provoca una pequeña animacion de aurora boreal donde lo impacto".
    if (this.ability.flareImmune && this.planet === "earth") {
      this.flareParticles.forEachActive((x, y, deactivate) => {
        if (circlesOverlap(x, y, 0, p.x, p.y, this.player.radius + 12)) {
          this.spawnAuroraBurst(x, y);
          deactivate();
        }
      });
    } else if (!this.ability.flareImmune && !shielded) {
      this.flareParticles.forEachActive((x, y, deactivate) => {
        if (circlesOverlap(x, y, 0, p.x, p.y, this.player.radius + 12) && this.player.hit()) {
          this.applyDamage(1);
          deactivate();
        }
      });
    }

    // Luna de la Tierra destruye asteroides que toca, solo en hipervelocidad
    // (la órbita lenta pasiva es decorativa) — ver AGENTS.md §5
    if (this.earthMoon && this.ability.isActive) {
      for (let i = this.fieldObjects.length - 1; i >= 0; i--) {
        const obj = this.fieldObjects[i];
        if (obj.kind !== "asteroid") continue;
        if (circlesOverlap(obj.sprite.x, obj.sprite.y, obj.radius * obj.sprite.scale.x, this.earthMoon.x, this.earthMoon.y, 14)) {
          this.absorbParticles.spawn(obj.sprite.x, obj.sprite.y, 0, 0, 300, 1);
          this.gameLayer.removeChild(obj.sprite);
          obj.destroy();
          this.fieldObjects.splice(i, 1);
        }
      }
    }

    // Lava de Marte desintegra asteroides cercanos — ver AGENTS.md §5
    if (this.ability.lavaBurstActive) {
      for (let i = this.fieldObjects.length - 1; i >= 0; i--) {
        const obj = this.fieldObjects[i];
        if (obj.kind !== "asteroid") continue;
        if (Math.hypot(obj.sprite.x - p.x, obj.sprite.y - p.y) < this.gameConfig.abilityParams.mars.lavaRange) {
          this.lavaParticles.spawn(obj.sprite.x, obj.sprite.y, 0, 0, 250, 1);
          this.gameLayer.removeChild(obj.sprite);
          obj.destroy();
          this.fieldObjects.splice(i, 1);
        }
      }
    }

    // Ayuda de un compañero Tierra/Marte cercano — desintegra asteroides
    // cerca del jugador LOCAL (no del compañero), pedido explícito del
    // usuario: "la luna de tierra me protege" — ver AGENTS.md §8.2.
    if (this.allyAid.destroyRadius > 0) {
      for (let i = this.fieldObjects.length - 1; i >= 0; i--) {
        const obj = this.fieldObjects[i];
        if (obj.kind !== "asteroid") continue;
        if (Math.hypot(obj.sprite.x - p.x, obj.sprite.y - p.y) < this.allyAid.destroyRadius) {
          this.absorbParticles.spawn(obj.sprite.x, obj.sprite.y, 0, 0, 260, 1);
          this.gameLayer.removeChild(obj.sprite);
          obj.destroy();
          this.fieldObjects.splice(i, 1);
        }
      }
    }

    for (let i = this.fieldObjects.length - 1; i >= 0; i--) {
      const obj = this.fieldObjects[i];
      if (!circlesOverlap(obj.sprite.x, obj.sprite.y, obj.radius * obj.sprite.scale.x, p.x, p.y, this.player.radius)) continue;

      if (obj.kind === "asteroid") {
        // Pasiva de Venus (2026-07-24) — "los asteroides pequeños que se
        // acerquen a venus... al chocar con venus se vuelven polvo... pero
        // los asteroides pequeños nunca le hacen nada a Venus". Se revisa
        // antes que cualquier otra rama: nunca aplica daño, sin importar el
        // escudo activo o cualquier otro estado.
        if (this.ability.smallAsteroidImmune && obj.radius < SMALL_ASTEROID_RADIUS * this.entityScale) {
          this.spawnDustBurst(obj.sprite.x, obj.sprite.y);
          this.gameLayer.removeChild(obj.sprite);
          obj.destroy();
          this.fieldObjects.splice(i, 1);
          continue;
        }
        if (destroysAsteroidsOnTouch) {
          // Sin daño, y cae directo al bloque de destrucción de abajo (no
          // hace `continue`) — a diferencia del escudo de Venus, lo destruye
          // al tocarlo. Se hace añicos — pedido explícito del usuario
          // (2026-07-23): hielo si es Neptuno ("que se vea mas epico el
          // poder de neptuno"), roca si es Mercurio ("obvio no congelados
          // pero se hacen cachitos").
          if (this.planet === "neptune") {
            this.spawnShatterBurst(this.iceShatterParticles, obj.sprite.x, obj.sprite.y);
          } else {
            this.spawnShatterBurst(this.rockShatterParticles, obj.sprite.x, obj.sprite.y);
          }
        } else if (shielded) {
          continue; // el escudo de Venus no destruye asteroides, solo protege
        } else if (this.player.hit()) {
          this.applyDamage(1);
          // Estaba congelado por Neptuno (propio o de la tormenta de
          // equipo) y lo tocó OTRO jugador (no Neptuno) — pedido explícito
          // del usuario: "cuando los choquen Neptuno u otro participante
          // los asteroides congelados tendran una pequeña animacion donde
          // se rompen en cachitos de hielo".
          if (obj.frozen) this.spawnShatterBurst(this.iceShatterParticles, obj.sprite.x, obj.sprite.y);
        }
      } else if (obj.kind === "pulsarSmall") {
        store.setLives(Math.min(MAX_LIVES, store.lives + 1));
      } else if (obj.kind === "pulsarLarge") {
        store.setLives(Math.min(MAX_LIVES, store.lives + 2));
      } else if (obj.kind === "star") {
        store.addStars(1);
        this.checkAndCommitStars();
      }

      this.gameLayer.removeChild(obj.sprite);
      obj.destroy();
      this.fieldObjects.splice(i, 1);
    }
  }

  /**
   * Único punto de entrada para quitar vidas — pedido explícito del
   * usuario (2026-07-22, ver AGENTS.md §5.1): "a todos los planetas cada
   * vez que algo les quite vida... quiero que momentáneamente cambien sus
   * facciones". Si el golpe NO mata, dispara una reacción facial aleatoria
   * (y le avisa a los demás jugadores en multijugador); si el golpe SÍ
   * mata, arranca la secuencia de muerte en vez de terminar de golpe.
   */
  private applyDamage(amount: number) {
    const store = useGameStore.getState();
    if (store.gameStatus !== "playing") return; // ya está muriendo/murió, ignora golpes de más
    const before = store.lives;
    store.loseLife(amount);
    const after = useGameStore.getState().lives;
    if (after <= 0) {
      this.beginDeathSequence();
    } else if (before > after) {
      const expression = this.faceOverlay.triggerRandomReaction();
      this.multiplayer?.sendFaceReaction(expression);
    }
  }

  /** Arranca la animación de muerte — ver DeathSequence.ts. `store.gameStatus` ya quedó en "dying" (ver gameStore.ts#loseLife). */
  private beginDeathSequence() {
    this.deathSequence.start();
    if (this.localNameLabel) this.localNameLabel.visible = false;
  }

  /** Llamado desde tick() mientras `gameStatus === "dying"` — ver AGENTS.md §5.1. */
  private updateDeathSequence(deltaMS: number) {
    const finished = this.deathSequence.update(deltaMS);
    this.faceOverlay.container.position.set(this.player.sprite.x, this.player.sprite.y);
    this.faceOverlay.container.scale.set(this.entityScale);

    if (finished) {
      // Frase épica al azar — configurable por admin (game_config.defeatPhrases,
      // pedido explícito del usuario: "debes tener 20 frases épicas de
      // derrota... deben ser configurables también por el admin"). Se usa
      // Math.random() (no el `rng` compartido) a propósito: es puramente
      // cosmético y local a este cliente, ver comentario de RNG en Sun.ts.
      const phrases = this.gameConfig.defeatPhrases;
      const phrase = phrases.length > 0 ? phrases[Math.floor(Math.random() * phrases.length)] : "";
      // Visible para los demás jugadores — pedido explícito del usuario:
      // "la explosión y la frase épica también son vistas por los demás
      // jugadores".
      this.multiplayer?.sendPlayerDefeated(phrase);
      useGameStore.getState().finishDeathSequence(phrase);
      speakDefeatPhrase(phrase);
    }
  }

  /** Frases flotantes de OTROS jugadores al morir — ver `showFloatingPhrase()`. */
  private updateFloatingTexts(deltaMS: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const entry = this.floatingTexts[i];
      entry.remainingMs -= deltaMS;
      entry.text.alpha = Math.min(1, entry.remainingMs / 400); // se desvanece al final
      if (entry.remainingMs <= 0) {
        this.gameLayer.removeChild(entry.text);
        entry.text.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  /** Ver AGENTS.md §7 (Fase 6) — se reporta una sola vez por partida. */
  private reportSessionComplete(level: number, starsCollected: number) {
    if (this.sessionReported) return;
    this.sessionReported = true;
    useGameStore.getState().setSessionSaveStatus("saving");
    // Solo se acredita el RESTO no guardado en vivo — ver
    // `checkAndCommitStars()` y AGENTS.md §7.3. `starsCollected` (el total)
    // sigue mandándose completo para el historial/leaderboard.
    const starsToCredit = Math.max(0, starsCollected - useGameStore.getState().starsCommitted);

    fetch("/api/sessions/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planet: this.planet,
        level,
        starsCollected,
        starsToCredit,
        roomId: this.multiplayer?.roomId,
        // Para resaltar su alias en el Top 5 de equipos — ver AGENTS.md §8.2.
        isLeader: this.multiplayer?.isLeader ?? false,
      }),
    })
      .then((res) => {
        useGameStore.getState().setSessionSaveStatus(res.ok ? "saved" : "error");
        if (!res.ok) console.error("El servidor rechazó el resultado de la partida", res.status);
      })
      .catch((err) => {
        // Sin conexión o sesión expirada: se pierde el RESTO sin guardar de
        // esta partida (como mucho <5 estrellas, ver AGENTS.md §7.3) — lo ya
        // guardado en vivo vía `checkAndCommitStars()` no se pierde.
        useGameStore.getState().setSessionSaveStatus("error");
        console.error("No se pudo guardar el resultado de la partida", err);
      });
  }

  /**
   * Guardado incremental cada 5 estrellas — pedido explícito del usuario
   * (2026-07-22): "guardarlas cada 5 estrellas... para que cuando suceda un
   * error y ya llevabas varias estrellas juntadas no pierdas todas". Se
   * dispara cada vez que se recolecta una estrella (ver `checkCollisions()`)
   * y reintenta solo, sin lógica extra: si un intento falla, `starsCommitted`
   * no avanza, así que la siguiente estrella vuelve a intentar guardar TODO
   * lo pendiente (no solo la nueva). Silencioso — no toca `sessionSaveStatus`
   * (esa señal es solo para el guardado final de fin de partida).
   */
  private checkAndCommitStars() {
    if (this.committingStars) return;
    const store = useGameStore.getState();
    const pending = store.starsThisRun - store.starsCommitted;
    if (pending < 5) return;
    const chunk = Math.floor(pending / 5) * 5;

    this.committingStars = true;
    fetch("/api/sessions/star-increment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: chunk }),
    })
      .then((res) => {
        if (res.ok) useGameStore.getState().markStarsCommitted(chunk);
        // Si falla, no se marca nada como guardado — la próxima estrella
        // recolectada vuelve a intentar guardar este mismo tramo pendiente.
      })
      .catch(() => {
        // Sin red: igual, se reintenta con la próxima estrella.
      })
      .finally(() => {
        this.committingStars = false;
      });
  }

  toggleMusicMuted() {
    const muted = !useGameStore.getState().musicMuted;
    useGameStore.getState().setMusicMuted(muted);
    this.music.setMuted(muted);
  }

  destroy() {
    // Trazabilidad — ver AGENTS.md/RETROSPECTIVA.md (2026-07-22): bug real
    // reportado en vivo donde el motor se remontaba a mitad de partida sin
    // ningún mensaje de derrota, perdiendo nivel/vidas. El stack ayuda a
    // distinguir un `destroy()` disparado por el cleanup normal de React
    // (navegación real, fin de partida) de uno inesperado.
    const store = useGameStore.getState();
    clientLog("warn", "game.engine.destroy", {
      planet: this.planet,
      level: this.level,
      lives: store.lives,
      gameStatus: store.gameStatus,
      sessionReported: this.sessionReported,
      stack: new Error("destroy() called from").stack,
    });
    this.destroyed = true;
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("pointerdown", this.resumeMusicOnce);
    window.removeEventListener("keydown", this.resumeMusicOnce);
    this.music.stop();
    // Frase épica narrada (ver engine/audio/speech.ts) — nunca debe seguir
    // hablando después de que el jugador ya navegó fuera de la partida.
    stopDefeatSpeech();
    this.input?.destroy();
    this.sun?.destroy();
    this.redSun?.destroy();
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    // Si `init()` todavía no resolvía, `mount()` se encarga de destruir la
    // app en cuanto termine — ver arriba.
    if (this.initialized) {
      this.app.destroy(true, { children: true });
    }
  }
}
