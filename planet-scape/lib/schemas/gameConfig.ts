import { z } from "zod";

/**
 * Documento único `game_config` — ver AGENTS.md §9 (Fase 8). Editable desde
 * el admin en runtime; el motor de juego lo lee al arrancar cada partida
 * (Server Component, ver lib/gameConfig.ts) — sin redeploy.
 *
 * `abilities` cubre duración/recarga de los 6 planetas jugables (los 4
 * iniciales + Júpiter/Saturno, desbloqueables con estrellas — ver AGENTS.md
 * §5 y §9) — el EFECTO de cada habilidad sigue siendo código
 * (`engine/abilities/*Ability.ts`); el catálogo dinámico de planetas
 * *nuevos* creados desde cero (más allá de estos 6) sigue fuera de alcance,
 * ver AGENTS.md §15.
 */
const AbilityTimingSchema = z.object({
  durationMs: z.number().int().positive(),
  cooldownMs: z.number().int().positive(),
});

// Reutilizado por Sol amarillo y Sol Rojo (ver AGENTS.md §5.1) — mismo
// SHAPE, pero cada uno guarda su propio documento de valores. Pedido
// explícito del usuario (2026-07-22): "las configuraciones del sol
// amarillo y el sol rojo... aunque inicialmente son las mismas, permite
// que cada quien tenga su configuración".
const SunConfigSchema = z.object({
  minFlares: z.number().int().min(1),
  maxFlares: z.number().int().min(1),
  spawnFrequencyMs: z.number().int().positive(),
});

// Reutilizado por el Agujero Negro clásico y el Nova (ver AGENTS.md §5.1) —
// mismo motivo que SunConfigSchema arriba: "lo mismo pasa con el agujero
// negro nova".
const BlackHoleConfigSchema = z.object({
  size: z.number().positive(),
  attractionForce: z.number().positive(),
  minClicksToDefeat: z.number().int().min(1),
  maxClicksToDefeat: z.number().int().min(1),
});

// Quasar (2026-07-24, ver AGENTS.md §5.1) — pedido explícito del usuario:
// "cuando aparezcan dos agujeros negros... nivel más altos dejalo
// configurable pero inicialo en el 55... vas a hacer una emulación de
// atracción entre ellos... generando un nuevo fenómeno llamado Quasar...
// configurable en admin la intensidad de atracción, nivel en que aparece,
// etc. Los rayos que saca si te tocan te quita de a 2 vidas, tiene también
// más fuerte atracción refiriéndonos a eso que es más grande su
// circunferencia de atracción... para derrotarlo son 25 pulsaciones".
const QuasarConfigSchema = z.object({
  minLevel: z.number().int().nonnegative(),
  // Multiplica el radio de atracción de asteroides respecto al de un
  // agujero negro normal (bh.radius * 5, ver GameEngine.ts) — "más grande
  // su circunferencia de atracción".
  attractionRadiusMultiplier: z.number().positive(),
  // Multiplica la fuerza de atracción (sobre asteroides Y sobre el
  // jugador) — "la intensidad de atracción".
  attractionIntensity: z.number().positive(),
  clicksToDefeat: z.number().int().min(1),
  rayDamageLives: z.number().int().min(1),
  size: z.number().positive(),
});

// Velocidad base por planeta (px/s, antes de multiplicadores de habilidad
// como Mercurio activo) — pedido explícito del usuario (2026-07-22): "en la
// ventana de admin permite que las velocidades sean individuales por
// planeta". Antes era un único valor global (`player.baseSpeed`, y antes de
// eso la constante fija `BASE_PLAYER_SPEED` en engine/GameEngine.ts).
const PlanetSpeedSchema = z.object({
  mercury: z.number().int().positive(),
  venus: z.number().int().positive(),
  earth: z.number().int().positive(),
  mars: z.number().int().positive(),
  jupiter: z.number().int().positive(),
  saturn: z.number().int().positive(),
  neptune: z.number().int().positive(),
});

// Parámetros de las habilidades (activas Y pasivas) más allá de
// duración/recarga — agregado 2026-07-24, pedido explícito del usuario: "no
// puedo modificar el porcentaje de velocidad a la que corre mercurio, asi
// como la velocidad de la luna en el planeta tierra... si es inmune a
// llamaradas sol amarillo y/o a llamaradas rojas, el radio de afectacion de
// los asteroides que afecta a saturno, etc". Solo cubre valores que ya
// tienen un efecto real y verificable en el motor (ver comentarios de cada
// planeta en engine/abilities/*.ts) — nunca un parámetro "de mentira" para
// una mecánica que en realidad no existe (ej. Júpiter no tiene pasiva
// numérica implementada, solo su bono de compañero — ver AGENTS.md §5).
const AbilityParamsSchema = z.object({
  mercury: z.object({
    speedMultiplier: z.number().positive(), // +250% de lanzamiento = 3.5
    slowfieldRadius: z.number().positive(),
    slowfieldFactor: z.number().min(0).max(1),
    flareImmune: z.boolean(),
  }),
  venus: z.object({
    smallAsteroidImmune: z.boolean(),
  }),
  earth: z.object({
    flareImmune: z.boolean(),
    moonActiveSpeedMultiplier: z.number().positive(),
  }),
  mars: z.object({
    lavaRange: z.number().positive(),
  }),
  // Júpiter: solo el bono de compañero (multijugador) tiene parámetros
  // numéricos reales — ver `tryShieldNearestAlly()` en GameEngine.ts.
  jupiter: z.object({
    allyShieldRange: z.number().positive(),
    allyHealLives: z.number().int().positive(),
    allyRewardStars: z.number().int().positive(),
  }),
  saturn: z.object({
    ringRepelRadius: z.number().positive(),
    redFlareImmuneWhileActive: z.boolean(),
    pulsarBoostSolo: z.number().min(0).max(1),
    pulsarBoostTeam: z.number().min(0).max(1),
  }),
  neptune: z.object({
    stormSlowfieldRadius: z.number().positive(),
    stormSlowfieldFactor: z.number().min(0).max(1),
    auraSlowfieldRadius: z.number().positive(),
    auraSlowfieldFactor: z.number().min(0).max(1),
  }),
});

export const GameConfigSchema = z.object({
  player: z.object({
    baseSpeedByPlanet: PlanetSpeedSchema,
  }),
  abilities: z.object({
    mercury: AbilityTimingSchema,
    venus: AbilityTimingSchema,
    earth: AbilityTimingSchema,
    mars: AbilityTimingSchema,
    jupiter: AbilityTimingSchema,
    saturn: AbilityTimingSchema,
    // Neptuno — gigante de hielo, planeta premium más caro (3500 ⭐, ver
    // AGENTS.md §5/§9) agregado 2026-07-23.
    neptune: AbilityTimingSchema,
  }),
  abilityParams: AbilityParamsSchema,
  // Velocidad base de la luna de la Tierra (rad/s, antes de la
  // multiplicación x15 de la habilidad activa "Hipervelocidad") — pedido
  // explícito del usuario (2026-07-22): "permite que la velocidad de la
  // luna que lo protege se pueda configurar". Antes era la constante fija
  // `EARTH_MOON_BASE_SPEED` en engine/abilities/earthAbility.ts.
  earthMoon: z.object({
    baseSpeed: z.number().positive(),
  }),
  sun: SunConfigSchema, // Sol amarillo (siempre presente, nivel 0+)
  // Sol Rojo (ver AGENTS.md §5.1) — documento independiente, editable por
  // separado desde /admin. `minLevel` (nivel a partir del cual aparece) ya
  // NO tiene piso mínimo — pedido explícito del usuario (2026-07-22):
  // "quita la restricción... para poder validarlos y ver cómo funcionan"
  // (el piso de 20 del pedido original ya había cumplido su propósito de
  // diseño de lanzamiento; el admin puede bajarlo para probar). Arranca en
  // 45 (valor de lanzamiento sin cambios).
  redSun: SunConfigSchema.extend({ minLevel: z.number().int().nonnegative() }),
  pulsars: z.object({ spawnFrequencyMs: z.number().int().positive() }),
  stars: z.object({ spawnFrequencyMs: z.number().int().positive() }),
  blackHole: BlackHoleConfigSchema, // Agujero Negro clásico (nivel 0+)
  // Agujero Negro Nova (ver AGENTS.md §5.1) — mismo criterio de `minLevel`
  // que redSun arriba (sin piso mínimo). Arranca en 60 (valor de lanzamiento sin cambios).
  novaBlackHole: BlackHoleConfigSchema.extend({ minLevel: z.number().int().nonnegative() }),
  // Quasar — nuevo fenómeno cuando el clásico y el Nova están activos a la
  // vez en niveles altos (ver AGENTS.md §5.1 y engine/entities/Quasar.ts).
  quasar: QuasarConfigSchema,
  whatsappLink: z.string(), // puede ser "" si aún no hay enlace real
  donation: z.object({
    minAmountCents: z.number().int().positive(),
    stepCents: z.number().int().positive(),
    maxAmountCents: z.number().int().positive(),
    rewardStars: z.number().int().nonnegative(),
  }),
  // Términos y Condiciones (2026-07-22, ver AGENTS.md §6.5) — editable
  // desde /admin (pestaña Configuración, botón "Editar Términos y
  // Condiciones"). El jugador debe aceptarlos para completar el registro
  // obligatorio de perfil (ver ProfileOnboarding.tsx).
  termsAndConditions: z.string(),
  // Frases épicas de derrota (2026-07-22, ver AGENTS.md §5.1) — una se
  // elige al azar al terminar la secuencia de muerte del jugador
  // (engine/GameEngine.ts#runDeathSequence). Pedido explícito del usuario:
  // "debes tener 20 frases épicas de derrota cortitas... deben ser
  // configurables también por el admin". Lista libre (no fija a 20) para
  // que el admin pueda agregar/quitar desde el textarea del panel.
  defeatPhrases: z.array(z.string().trim().min(1).max(120)).min(1),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

// Texto de lanzamiento de Términos y Condiciones — ver AGENTS.md §6.5.
// Redactado con el mismo espíritu que el aviso de aceptación de plataformas
// tipo Roblox al crear una cuenta: lenguaje simple, pensado para que lo
// entienda un jugador joven (o su papá/mamá leyéndolo con él), y honesto
// sobre que la edad es autodeclarada, no verificada. 100% editable desde
// /admin sin tocar código — este es solo el valor con el que arranca.
export const DEFAULT_TERMS_AND_CONDITIONS = `TÉRMINOS Y CONDICIONES DE PLANET SCAPE OF THE SOLAR SYSTEM

Última actualización: 22 de julio de 2026

¡Bienvenido a Planet Scape! Antes de jugar, es importante que leas esto (o que lo lea contigo un adulto responsable si eres menor de edad).

1. QUÉ DATOS TE PEDIMOS Y POR QUÉ
Para crear tu perfil te pedimos tu correo, nombre, apellido, un alias (el nombre con el que te van a ver los demás jugadores) y tu fecha de nacimiento. Te pedimos que estos datos sean REALES — no por curiosidad, sino porque nos ayudan a proteger a los jugadores más pequeños que usan este juego, y en particular a decidir de forma responsable quién puede usar la función de chat en vivo con otros jugadores (ver punto 3).

2. LA EDAD ES UN DATO QUE TÚ NOS DAS
Igual que en la mayoría de juegos y redes sociales (por ejemplo Roblox), no tenemos forma de verificar tu fecha de nacimiento con una identificación oficial — confiamos en que la información que nos diste es verdadera. Si eres menor de edad, te pedimos que captures tu fecha de nacimiento real y, de ser posible, que un padre, madre o tutor esté al tanto de que estás creando una cuenta.

3. CHAT EN VIVO — SOLO PARA MAYORES DE 18 AÑOS
Planet Scape es un juego para todas las edades. Sin embargo, la función de CHAT DE TEXTO EN VIVO durante una partida multijugador solo está disponible cuando TODOS los jugadores presentes en esa partida son mayores de 18 años. Si algún jugador de la sala es menor de edad (o no completó su fecha de nacimiento), el botón de chat no aparece para nadie en esa partida — ni siquiera para los jugadores adultos. Esto es automático y no se puede desactivar manualmente.

4. BUEN COMPORTAMIENTO
Al usar el chat (cuando esté disponible), te comprometes a: (a) no compartir datos personales sensibles tuyos ni de nadie más, (b) no usar lenguaje ofensivo, discriminatorio o agresivo, y (c) tratar a los demás jugadores con respeto. Nos reservamos el derecho de suspender el acceso al chat a quien no siga estas reglas.

5. TUS ESTRELLAS Y TU PROGRESO
Las estrellas, niveles y logros que consigas se guardan asociados a tu cuenta (tu correo). Si decides borrar tu cuenta, un administrador puede eliminar tu información permanentemente, incluyendo tu historial de partidas.

6. APORTACIONES VOLUNTARIAS
Planet Scape ofrece la opción de hacer una aportación voluntaria para apoyar el desarrollo del juego. Esto es completamente opcional y nunca es necesario para poder jugar.

7. CAMBIOS A ESTOS TÉRMINOS
Estos Términos y Condiciones pueden actualizarse en cualquier momento. La versión vigente siempre es la que ves en pantalla al momento de aceptar.

8. ACEPTACIÓN
Para poder jugar, debes marcar la casilla de aceptación de estos Términos y Condiciones. Si no estás de acuerdo, lamentablemente no podrás crear tu perfil ni jugar.

¿Dudas? Contáctanos por WhatsApp desde el enlace en la pantalla principal.`;

/** Valores de lanzamiento — ver constantes que ya existían hardcodeadas en engine/*. */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  // Antes un único `player.baseSpeed` global (y antes de eso la constante
  // fija `BASE_PLAYER_SPEED` en engine/GameEngine.ts, subida de 310→420 tras
  // feedback real de que el personaje se sentía lento) — ahora un valor por
  // planeta, todos arrancan iguales pero se pueden editar por separado.
  player: {
    baseSpeedByPlanet: { mercury: 420, venus: 420, earth: 420, mars: 420, jupiter: 420, saturn: 420, neptune: 420 },
  },
  abilities: {
    mercury: { durationMs: 6000, cooldownMs: 30000 },
    venus: { durationMs: 10000, cooldownMs: 30000 },
    earth: { durationMs: 15000, cooldownMs: 30000 },
    mars: { durationMs: 10000, cooldownMs: 30000 },
    jupiter: { durationMs: 20000, cooldownMs: 35000 },
    saturn: { durationMs: 20000, cooldownMs: 35000 },
    // Neptuno — ver engine/abilities/neptuneAbility.ts (mismos valores de
    // lanzamiento que la clase, aquí solo por si el admin los reajusta).
    neptune: { durationMs: 12000, cooldownMs: 40000 },
  },
  // Parámetros de habilidades más allá de duración/recarga (2026-07-24, ver
  // AGENTS.md §9) — valores de lanzamiento, iguales a los que ya estaban
  // hardcodeados en cada engine/abilities/*.ts antes de este cambio.
  abilityParams: {
    mercury: { speedMultiplier: 3.5, slowfieldRadius: 400, slowfieldFactor: 0.3, flareImmune: true },
    venus: { smallAsteroidImmune: true },
    earth: { flareImmune: true, moonActiveSpeedMultiplier: 15 },
    mars: { lavaRange: 130 },
    jupiter: { allyShieldRange: 260, allyHealLives: 3, allyRewardStars: 3 },
    saturn: { ringRepelRadius: 160, redFlareImmuneWhileActive: true, pulsarBoostSolo: 0.3, pulsarBoostTeam: 0.5 },
    neptune: { stormSlowfieldRadius: 260, stormSlowfieldFactor: 0.08, auraSlowfieldRadius: 140, auraSlowfieldFactor: 0.5 },
  },
  // Antes `EARTH_MOON_BASE_SPEED` fija en engine/abilities/earthAbility.ts.
  earthMoon: { baseSpeed: 0.9 },
  // Rango ampliado a pedido explícito del usuario (2026-07-22): "pon el
  // mínimo en 6 y el máximo en 100... a mayor nivel más llamaradas". Sigue
  // creciendo con el nivel vía la misma fórmula de Sun.ts (min + nivel*0.8,
  // topado en maxFlares) — 100 es un techo deliberadamente alto para
  // niveles muy avanzados, no el valor típico de una partida normal.
  sun: { minFlares: 6, maxFlares: 100, spawnFrequencyMs: 3200 },
  // Sol Rojo (nivel 45+) — arranca IGUAL que el amarillo ("inicialmente son
  // las mismas", pedido explícito del usuario 2026-07-22), editable aparte
  // desde /admin a partir de aquí.
  redSun: { minFlares: 6, maxFlares: 100, spawnFrequencyMs: 3200, minLevel: 45 },
  pulsars: { spawnFrequencyMs: 5200 },
  stars: { spawnFrequencyMs: 3000 },
  blackHole: { size: 46, attractionForce: 1, minClicksToDefeat: 3, maxClicksToDefeat: 20 },
  // Agujero Negro Nova (nivel 60+) — arranca IGUAL que el clásico, editable
  // aparte desde /admin a partir de aquí.
  novaBlackHole: { size: 46, attractionForce: 1, minClicksToDefeat: 3, maxClicksToDefeat: 20, minLevel: 60 },
  // Quasar (nivel 55+) — atracción IGUAL que un agujero negro normal
  // (multiplicador/intensidad = 1, mismo criterio que blackHole/
  // novaBlackHole) — pedido explícito del usuario tras probarlo en vivo
  // (2026-07-24): "dejemos los parametros de atraccion y nivel de daño
  // igual que el del agujero negro nova ya que solo con pasar me atrapa
  // hasta que me mata, yo creo que ya con el rayo es suficiente" (el radio/
  // intensidad más grandes del diseño original resultaban demasiado
  // punitivos una vez sumados al haz de luz constante). 25 clics para
  // derrotarlo, sus rayos quitan 2 vidas por impacto.
  quasar: { minLevel: 55, attractionRadiusMultiplier: 1, attractionIntensity: 1, clicksToDefeat: 25, rayDamageLives: 2, size: 60 },
  whatsappLink: "",
  donation: { minAmountCents: 10000, stepCents: 5000, maxAmountCents: 1000000, rewardStars: 200 },
  termsAndConditions: DEFAULT_TERMS_AND_CONDITIONS,
  defeatPhrases: [
    "¡Me consumió la oscuridad del espacio!",
    "¡Volveré más brillante que nunca!",
    "¡Esto no es un adiós, es un hasta la próxima órbita!",
    "¡Que alguien avise a la Vía Láctea!",
    "¡Caigo, pero mi órbita vivirá para siempre!",
    "¡Fui una estrella fugaz mientras duró!",
    "¡Ni el Big Bang vio venir esto!",
    "¡Apaguen las luces, el show terminó!",
    "¡Me llevo el récord de la explosión más elegante!",
    "¡El universo no estaba listo para mí!",
    "¡Esto es solo una pausa cósmica!",
    "¡Regresaré con más gravedad!",
    "¡Mi brillo se apaga, pero mi leyenda no!",
    "¡Fue un honor orbitar con ustedes!",
    "¡Otra vez será, exploradores!",
    "¡El espacio profundo me reclama!",
    "¡Ni un agujero negro me detendrá la próxima vez!",
    "¡Fin del vuelo... por ahora!",
    "¡Que mi polvo estelar los inspire!",
    "¡Nos vemos en la próxima galaxia!",
    "¡Fui derrotado, pero mi historia sigue brillando!",
    "¡Fundido a negro... como un buen eclipse!",
    "¡Ups! Creo que exploté un poco fuerte.",
    "¡La gravedad ganó esta ronda!",
    "¡Mi núcleo dice adiós, no hasta nunca!",
    "¡Esto se pondrá en mi diario espacial!",
    "¡Un cometa se llevará la noticia!",
    "¡Fin del juego, no del universo!",
    "¡Me voy en una nube de polvo estelar!",
    "¡La próxima vez esquivo mejor, lo prometo!",
    "¡Fue un viaje estelar increíble!",
    "¡Mi órbita se despide con estilo!",
    "¡Fulminado, pero invicto en espíritu!",
    "¡Fue divertido mientras giraba!",
    "¡Que la fuerza gravitacional los acompañe!",
    "¡Colapsé como una supernova de lujo!",
    "¡Adiós, mundo cruel... nos vemos mañana!",
    "¡Ya volveré a iluminar el cosmos!",
    "¡Esto no se queda así, planeta vengador!",
    "¡Mi última órbita fue legendaria!",
  ],
};
