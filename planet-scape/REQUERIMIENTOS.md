# REQUERIMIENTOS.md — Planet Scape of the Solar System

> Documento de requisitos funcionales (RF) y no funcionales (RNF), derivado de todo lo pedido/implementado a lo largo del proyecto (ver [`AGENTS.md`](./AGENTS.md), fuente de verdad narrativa/de gobernanza). Este documento es un **checklist estructurado y trazable** — cada requisito tiene un ID, un estado y un enlace a la sección de `AGENTS.md` con el detalle técnico completo. No duplica ese detalle aquí.
>
> Sincronizado bajo la misma regla de [`AGENTS.md` §0.1](./AGENTS.md#01-regla-de-sincronizacion-de-documentacion): todo requisito nuevo pedido por el usuario se agrega aquí en la misma sesión en la que se documenta en `AGENTS.md`.

**Leyenda de estado**: ✅ implementado y verificado · 🚧 implementado, verificación parcial · ⏳ pendiente / fuera de alcance por ahora.

---

## 1. Requisitos Funcionales (RF)

### 1.1 Autenticación y sesión (RF-AUTH)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-AUTH-01 | El sistema debe permitir iniciar sesión sin contraseña, mediante un enlace mágico (Magic Link) enviado por correo. | ✅ | [§6](./AGENTS.md#6-autenticacion-magic-link) |
| RF-AUTH-02 | Como alternativa al enlace, el correo debe incluir un código numérico de 6 dígitos que el jugador puede teclear directamente para entrar. | ✅ | [§6.3](./AGENTS.md#63-login-por-codigo-de-6-digitos--implementado-reemplaza-el-token-largo) |
| RF-AUTH-03 | El código de acceso debe expirar a los 10 minutos y solo puede usarse una vez. | ✅ | [§6.3](./AGENTS.md#63-login-por-codigo-de-6-digitos--implementado-reemplaza-el-token-largo) |
| RF-AUTH-04 | El endpoint de verificación de código debe estar protegido por límite de tasa (rate limiting) para mitigar fuerza bruta. | ✅ | [§6.3](./AGENTS.md#63-login-por-codigo-de-6-digitos--implementado-reemplaza-el-token-largo) |
| RF-AUTH-05 | Si el correo no existe todavía en la base de datos, debe crearse un perfil de jugador nuevo automáticamente al iniciar sesión por primera vez. | ✅ | [§6](./AGENTS.md#6-autenticacion-magic-link) |
| RF-AUTH-06 | El jugador debe poder cerrar sesión desde cualquier pantalla. | ✅ | [§6](./AGENTS.md#6-autenticacion-magic-link) |
| RF-AUTH-07 | El jugador que olvidó su correo debe poder recuperar su cuenta indicando su alias y fecha de nacimiento; si coinciden con una cuenta registrada y esa cuenta tiene un teléfono guardado, se le envía el correo por WhatsApp. Si no hay teléfono registrado, se le informa que la cuenta es irrecuperable. | ✅ | [§6.7](./AGENTS.md#67-recuperacion-de-cuenta-por-alias--fecha-de-nacimiento--implementado) |

### 1.2 Perfil de jugador (RF-PERF)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-PERF-01 | Al primer inicio de sesión, el jugador debe registrar obligatoriamente: nombre, apellido, alias único, fecha de nacimiento y aceptación de los Términos y Condiciones. | ✅ | [§6.4](./AGENTS.md#64-registro-obligatorio-de-perfil-alias--implementado), [§6.5](./AGENTS.md#65-edad-terminos-y-condiciones-y-chat-de-texto-en-vivo--implementado) |
| RF-PERF-02 | El alias debe validarse dinámicamente contra la base de datos (disponible/tomado) antes de poder enviarse; si está tomado, el sistema debe sugerir una variante disponible. | ✅ | [§6.4](./AGENTS.md#64-registro-obligatorio-de-perfil-alias--implementado) |
| RF-PERF-03 | El registro de perfil debe poder cerrarse temporalmente sin completarse (para no atrapar al jugador), pero debe volver a aparecer en cada carga de página hasta completarse de verdad. | ✅ | [§2.4](./AGENTS.md#24-ronda-de-retroalimentacion-en-vivo-4-2026-07-22) |
| RF-PERF-04 | El sistema debe derivar si el jugador es mayor de edad (18+) a partir de su fecha de nacimiento, sin exponer la fecha exacta al cliente. | ✅ | [§6.5](./AGENTS.md#65-edad-terminos-y-condiciones-y-chat-de-texto-en-vivo--implementado) |
| RF-PERF-05 | El teléfono celular y la nacionalidad deben poder registrarse de forma opcional, sin bloquear el registro. | ✅ | [§6.7](./AGENTS.md#67-recuperacion-de-cuenta-por-alias--fecha-de-nacimiento--implementado) |
| RF-PERF-06 | Debe quedar un registro en base de datos de la fecha exacta en que el jugador aceptó los Términos y Condiciones vigentes. | ✅ | [§6.7](./AGENTS.md#67-recuperacion-de-cuenta-por-alias--fecha-de-nacimiento--implementado) |
| RF-PERF-07 | Un administrador debe poder corregir manualmente nombre/apellido/alias de cualquier jugador. | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-PERF-08 | El jugador debe poder ver su propio perfil, incluidos los datos que no puede editar (nombre, apellido, correo principal, fecha de nacimiento). | ✅ | [§6.8](./AGENTS.md#68-autoservicio-de-perfil-y-solicitudes-de-cambio-de-datos-sensibles--implementado) |
| RF-PERF-09 | El jugador debe poder editar por sí mismo: su alias (validado por disponibilidad), su teléfono, y un correo de recuperación nuevo y persistente (distinto del correo principal de la cuenta). | ✅ | [§6.8](./AGENTS.md#68-autoservicio-de-perfil-y-solicitudes-de-cambio-de-datos-sensibles--implementado) |
| RF-PERF-10 | El jugador NUNCA debe poder cambiar directamente su correo principal, nombre, apellido o fecha de nacimiento. | ✅ | [§6.8](./AGENTS.md#68-autoservicio-de-perfil-y-solicitudes-de-cambio-de-datos-sensibles--implementado) |
| RF-PERF-11 | Al intentar corregir un dato bloqueado, el sistema debe mostrar un aviso de que es un dato sensible y ofrecer una solicitud de cambio justificada, advirtiendo que se pueden pedir documentos para comprobar la propiedad de la cuenta. | ✅ | [§6.8](./AGENTS.md#68-autoservicio-de-perfil-y-solicitudes-de-cambio-de-datos-sensibles--implementado) |
| RF-PERF-12 | Un administrador debe revisar manualmente cada solicitud de cambio de datos sensibles (notificar/aprobar/rechazar); aprobarla nunca aplica el cambio automáticamente. | ✅ | [§6.8](./AGENTS.md#68-autoservicio-de-perfil-y-solicitudes-de-cambio-de-datos-sensibles--implementado) |
| RF-PERF-13 | Un administrador debe poder corregir también la fecha de nacimiento y el teléfono de cualquier jugador (no solo nombre/apellido/alias). | ✅ | [§6.8](./AGENTS.md#68-autoservicio-de-perfil-y-solicitudes-de-cambio-de-datos-sensibles--implementado) |

### 1.3 Landing y selección de planeta (RF-LAND)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-LAND-01 | La landing debe mostrar un dato curioso del espacio distinto en cada visita, sin repetirse en visitas consecutivas. | ✅ | [§2](./AGENTS.md#2-plan-de-fases-planificacion-estricta) |
| RF-LAND-02 | El jugador debe poder elegir entre 7 planetas jugables (4 iniciales gratis + Júpiter/Saturno/Neptuno desbloqueables) mediante un carrusel elíptico interactivo (mouse/arrastre, con inercia). | ✅ | [§2.2](./AGENTS.md#22-ronda-de-retroalimentacion-en-vivo-2-2026-07-22), [§5.4](./AGENTS.md#54-neptuno--gigante-de-hielo-el-planeta-premium-mas-caro--implementado) |
| RF-LAND-03 | Cada planeta premium (Júpiter, Saturno, Neptuno) debe tener un costo fijo en estrellas, con confirmación explícita antes de gastar. | ✅ | [§5.2](./AGENTS.md#52-desbloqueo-de-planetas-premium-con-estrellas--implementado) |
| RF-LAND-08 | Debe existir una sección informativa por planeta con datos astronómicos reales (posición desde el Sol, período orbital comparado con la Tierra, datos curiosos) y una descripción de sus habilidades del juego indicando si son individuales o también ayudan al equipo. | ✅ | [§5.4](./AGENTS.md#54-neptuno--gigante-de-hielo-el-planeta-premium-mas-caro--implementado) |
| RF-LAND-04 | Un planeta ya comprado debe quedar desbloqueado permanentemente para esa cuenta, en cualquier sesión futura. | ✅ | [§5.2](./AGENTS.md#52-desbloqueo-de-planetas-premium-con-estrellas--implementado) |
| RF-LAND-05 | El acceso directo por URL a un planeta premium no comprado debe rechazarse en el servidor (no solo ocultarse en la UI). | ✅ | [§5.2](./AGENTS.md#52-desbloqueo-de-planetas-premium-con-estrellas--implementado) |
| RF-LAND-06 | Debe mostrarse un contador de popularidad (❤️) por planeta, incrementado cuando una partida real inicia con ese planeta — tanto en partidas individuales/solas como en partidas de sala multijugador (mismo punto de conteo, `GameCanvas.tsx`, compartido por ambos flujos). | ✅ | [§2.4](./AGENTS.md#24-ronda-de-retroalimentacion-en-vivo-4-2026-07-22) |
| RF-LAND-07 | Debe mostrarse un top 10 (leaderboard) global, indicando con qué planeta se logró cada puntaje — TODAS las entradas, no solo la de mayor nivel. | ✅ | [§2.4](./AGENTS.md#24-ronda-de-retroalimentacion-en-vivo-4-2026-07-22) — bug real de datos faltantes corregido 2026-07-22, ver `RETROSPECTIVA.md` |
| RF-LAND-09 | El ícono de información de cada planeta debe vivir en la propia tarjeta del carrusel (no en un botón único fuera de él), separado del contador de popularidad, con tamaño y espaciado suficiente para tocarlo con comodidad. | ✅ | [§2.6](./AGENTS.md#26-ronda-de-retroalimentacion-en-vivo-6-2026-07-24) |
| RF-LAND-10 | El top 10 individual y el top 10 de equipos deben mostrarse lado a lado en escritorio (individual a la izquierda) y apilados en móvil (individual arriba). El top de equipos también debe mostrar hasta 10 entradas, no solo 5. | ✅ | [§2.6](./AGENTS.md#26-ronda-de-retroalimentacion-en-vivo-6-2026-07-24) |
| RF-LAND-11 | El dato curioso de la landing debe rotar automáticamente mientras el jugador sigue en la página (sin recargar), y su tarjeta debe tener contraste visual fuerte contra el resto de la paleta de la landing. | ✅ | [§2.6](./AGENTS.md#26-ronda-de-retroalimentacion-en-vivo-6-2026-07-24) |

### 1.4 Motor de juego — mecánicas núcleo (RF-GAME)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-GAME-01 | El jugador debe controlar su planeta con flechas de teclado, arrastre táctil (móvil) o siguiendo el cursor del mouse/touchpad (PC) sin necesitar clic. | ✅ | [§2.1](./AGENTS.md#21-ronda-de-retroalimentacion-en-vivo-post-fase-8-2026-07-22) |
| RF-GAME-02 | Deben aparecer asteroides de formas geoides (no circulares), tamaños y velocidades variadas, entrando desde cualquier punto de 360°. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-03 | La frecuencia y variedad de velocidad de los asteroides debe aumentar con el nivel, sin llegar nunca a un tope que detenga su crecimiento en niveles altos. | ✅ | [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22) |
| RF-GAME-04 | Debe aparecer un Sol animado que entra por un borde, escupe entre `minFlares` y `maxFlares` llamaradas (rango crece con el nivel, configurable por admin). | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno), [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-GAME-05 | A partir del nivel 45 debe aparecer además un **Sol Rojo**, con las mismas fases/configuración que el Sol amarillo, cuyas llamaradas rojizas no pueden ser bloqueadas por ningún escudo o inmunidad. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno), [§4](./AGENTS.md#4-motor-grafico-y-animacion) |
| RF-GAME-06 | Deben aparecer pulsares (chico: +1 vida, grande: +2 vidas) y estrellas de David (moneda acumulable del juego). | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-07 | Debe aparecer un Agujero Negro con fase de aviso (enana azul neón parpadeante), fase activa (atrae y "devora" asteroides cercanos, crece con el tiempo) y derrota por clics rápidos (3 a 20 según el nivel). Derrotarlo sube de nivel. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-08 | A partir del nivel 60 debe aparecer un segundo Agujero Negro ("Nova"), con un aspecto visual de disco de acreción más vistoso que brilla y parpadea, que triplica la frecuencia de aparición de asteroides mientras está activo y se derrota igual que el clásico. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-09 | Si hay dos agujeros negros activos a la vez, cada clic/tecla debe afectar primero al que apareció primero (orden FIFO), no a ambos ni a uno arbitrario. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-10 | El fondo (constelaciones/nebulosas/galaxias) debe desplazarse en paralaje, con la velocidad de desplazamiento aumentando con el nivel (hasta el doble a partir del nivel 40). | ✅ | [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22) |
| RF-GAME-11 | A partir del nivel 40 deben aparecer, como capa puramente decorativa, constelaciones de "Pegaso, Fénix, Andrómeda, Dragón, Cisne" y los 12 signos zodiacales, brillando y parpadeando (los 12 zodiacales en color dorado). | ✅ | [§4](./AGENTS.md#4-motor-grafico-y-animacion) |
| RF-GAME-12 | El juego debe tener 10 vidas iniciales y comenzar en nivel 0; el juego termina cuando las vidas llegan a 0. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-13 | El jugador debe poder salir de una partida en curso desde un botón visible, con confirmación explícita antes de perder el progreso. | ✅ | [§2.2](./AGENTS.md#22-ronda-de-retroalimentacion-en-vivo-2-2026-07-22) |
| RF-GAME-14 | El tamaño de las entidades (jugador, Sol, asteroides, agujeros negros) debe escalarse hacia abajo en pantallas móviles angostas, sin afectar el tamaño en escritorio/laptop. | ✅ | [§2.1](./AGENTS.md#21-ronda-de-retroalimentacion-en-vivo-post-fase-8-2026-07-22), [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22) |
| RF-GAME-15 | Debe sonar música de fondo (sintetizada, 4 melodías alegres estilo chiptune, rotación aleatoria), y el jugador debe poder elegir una melodía o subir su propia canción antes de empezar a jugar, además de silenciarla durante la partida. | ✅ | [§4](./AGENTS.md#4-motor-grafico-y-animacion) |
| RF-GAME-16 | La velocidad base de movimiento debe ser configurable de forma individual por planeta (no un único valor global). | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-GAME-17 | La velocidad de órbita de la luna de la Tierra debe ser configurable. | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-GAME-18 | El Sol amarillo y el Sol Rojo deben tener configuraciones de balance independientes (arrancan iguales, editables por separado); lo mismo para el Agujero Negro clásico y el Nova. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-19 | El nivel a partir del cual aparecen el Sol Rojo y el Agujero Negro Nova debe ser editable desde el admin, sin piso mínimo (el límite original de nivel 20 se removió a pedido explícito del usuario para poder validar ambas features en niveles bajos). | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-20 | Toda pantalla de creación/espera de sala multijugador (crear/unirse a sala, elegir música antes de jugar) debe tener una forma explícita de salir/cancelar, sin depender del botón "atrás" del navegador. | ✅ | [§16 changelog 2026-07-22](./AGENTS.md#16-registro-de-cambios-changelog) |
| RF-GAME-21 | Cualquier planeta debe mostrar momentáneamente una reacción facial chistosa aleatoria (de un catálogo de 7) cada vez que recibe daño sin morir. | ✅ | [§5.3](./AGENTS.md#53-reacciones-faciales-y-secuencia-de-muerte--implementado) |
| RF-GAME-22 | Al perder la última vida, el juego debe reproducir una secuencia de muerte (~2.5s: reacción de miedo/asombro, tinte rojo progresivo, cuarteaduras, vibración, explosión) antes de mostrar la pantalla de fin de partida, en vez de terminar abruptamente. | ✅ | [§5.3](./AGENTS.md#53-reacciones-faciales-y-secuencia-de-muerte--implementado) |
| RF-GAME-23 | Al terminar la secuencia de muerte, debe mostrarse una frase épica de derrota elegida al azar de una lista configurable por el admin (mínimo 40 frases de lanzamiento). | ✅ | [§5.3](./AGENTS.md#53-reacciones-faciales-y-secuencia-de-muerte--implementado) |
| RF-GAME-24 | La frase épica de derrota debe narrarse en voz además de mostrarse en texto. | ✅ | [§5.3](./AGENTS.md#53-reacciones-faciales-y-secuencia-de-muerte--implementado) |
| RF-GAME-25 | La pantalla de fin de partida del jugador derrotado debe mostrar un retrato triste de su propio planeta. | ✅ | [§5.3](./AGENTS.md#53-reacciones-faciales-y-secuencia-de-muerte--implementado) |
| RF-GAME-26 | En multijugador, la reacción facial, la secuencia de muerte y la frase épica de un jugador deben ser visibles también para sus compañeros de sala, no solo para él mismo. | ✅ | [§5.3](./AGENTS.md#53-reacciones-faciales-y-secuencia-de-muerte--implementado) |
| RF-GAME-28 | Cuando el Agujero Negro clásico y el Nova estén activos a la vez en un nivel configurable (55 de lanzamiento), ambos deben congelarse/ocultarse y fusionarse en un nuevo fenómeno llamado Quasar mediante una animación de acercamiento y fusión — ninguno de los dos agujeros negros debe ser atacable durante esa animación. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-29 | El Quasar activo debe emitir un haz de luz constante y giratorio que quita 2 vidas al contacto (configurable), sin que ningún escudo/inmunidad lo bloquee, y debe atraer asteroides y al jugador con la misma fuerza/radio que un agujero negro normal (ambos configurables por admin). Debe derrotarse con un número fijo de clics (25 de lanzamiento, configurable); al derrotarlo debe subir 2 niveles (representa 2 agujeros negros fusionados) y reiniciar el clásico/Nova a su ciclo normal. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno), [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-GAME-30 | El jugador debe arrancar siempre con 10 vidas, pero puede curarse por encima de ese valor (pulsares, bono de compañero de Júpiter) hasta un tope de 16. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-31 | La fusión del Quasar debe mostrar una explosión de polvo de colores neón al completarse, y su disco activo debe mostrarse como anillos de polvo de colores parpadeantes (no trazos lisos) girando a un ritmo pausado. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-32 | En PC/laptop (no en móvil), la velocidad y frecuencia de aparición de los asteroides deben escalar con el ancho real de la pantalla (tope 3x), para que la sensación de ritmo sea comparable a la de un celular; este ajuste nunca debe aplicarse en multijugador. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |
| RF-GAME-33 | En PC/laptop (no en móvil ni en multijugador), debe poder probarse la velocidad de movimiento del jugador al doble de su valor configurado, como prueba de balance. | ✅ | [§5.1](./AGENTS.md#51-objetos-del-entorno) |

### 1.5 Habilidades de los planetas (RF-AB)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-AB-01 | Mercurio: pasiva de inmunidad a llamaradas (del Sol amarillo) + activa de súper-velocidad con campo de ralentización de asteroides cercanos. | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-02 | Venus: escudo de invulnerabilidad temporal. | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-03 | Tierra: luna en hipervelocidad orbital que destruye asteroides al tocarlos. | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-04 | Marte: ráfagas de lava en 360° de corto alcance que desintegran asteroides cercanos. | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-05 | Júpiter: en solitario, escudo propio CON indicador visual (aura); en multijugador, además protege al primer compañero cercano (+3 vidas, invulnerabilidad temporal, +3 estrellas para Júpiter). | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas), [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22) |
| RF-GAME-27 | La velocidad de desplazamiento del fondo (nebulosas/constelaciones) debe acelerarse notoriamente a partir del nivel 40, para transmitir que el juego está en un nivel mucho más avanzado. | ✅ | [§4](./AGENTS.md#4-motor-grafico-y-animacion) |
| RF-AB-06 | Saturno: anillos que repelen Y desvían/frenan de verdad la trayectoria de los asteroides cercanos (activa, incluso los rápidos), único planeta con defensa contra las llamaradas del Sol Rojo mientras la habilidad está activa, y probabilidad de pulsares aumentada como pasiva (+30% en solitario, el doble en equipo, compartida con TODA la sala). | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-07 | El tiempo de duración/recarga de cada habilidad debe ser editable desde el panel de administración sin redeploy. | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-AB-08 | El control de activación de habilidad debe ser universal: `Spacebar`/clic en PC, botón flotante independiente en móvil (nunca compartido con el botón de atacar al agujero negro). | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-09 | Mercurio: mientras su habilidad activa está encendida, es inmune a los asteroides y los destruye al tocarlos (en vez de recibir daño). | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-10 | Neptuno: pasiva de ralentización leve siempre activa (individual) + activa de congelamiento fuerte que destruye asteroides al tocarlo, con un efecto de equipo de sala completa (todos los jugadores sienten una versión más leve del congelamiento mientras está activa, sin importar la distancia). Planeta premium más caro del juego (3500 ⭐). | ✅ | [§5.4](./AGENTS.md#54-neptuno--gigante-de-hielo-el-planeta-premium-mas-caro--implementado) |
| RF-AB-11 | Neptuno debe congelar los asteroides con un tinte azul hielo propio, distinto del cian genérico de Mercurio; cualquier jugador que destruya un asteroide congelado (Neptuno u otro) debe ver una animación de añicos de hielo. Mercurio debe mostrar añicos de roca (no hielo) al destruir asteroides con su súper-velocidad. | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-12 | Venus: pasiva siempre activa — los asteroides pequeños que se acercan se tiñen de rojo/naranja como si se calentaran, y al tocar a Venus se destruyen en una nube de polvo sin dañarlo nunca. | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |
| RF-AB-13 | Tierra: pasiva siempre activa — su campo magnético la protege de las llamaradas del Sol amarillo (nunca del Sol Rojo); cada impacto bloqueado debe mostrar una animación de aurora boreal en el punto de contacto. | ✅ | [§5](./AGENTS.md#5-atributos-y-habilidades-de-los-planetas) |

### 1.6 Multijugador (RF-MP)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-MP-01 | Debe permitirse crear o unirse a salas de hasta 4 jugadores mediante un código de sala. | ✅ | [§8](./AGENTS.md#8-multijugador-partykit--implementado-y-probado-con-2-navegadores-reales) |
| RF-MP-02 | La pantalla de unirse a una sala debe listar en vivo las salas abiertas que aún no están llenas, con "Unirme" deshabilitado si ya están completas. | ✅ | [§8.1](./AGENTS.md#81-directorio-de-salas-abiertas--implementado-y-probado) |
| RF-MP-03 | El lobby debe tener un temporizador de espera (180s) con opción de "Iniciar ahora" para omitirlo. | ✅ | [§8](./AGENTS.md#8-multijugador-partykit--implementado-y-probado-con-2-navegadores-reales) |
| RF-MP-04 | Todos los jugadores de una sala deben ver el mismo mundo (mismos asteroides/Sol/agujero negro en la misma posición), mediante simulación determinista por semilla compartida. | ✅ | [§8](./AGENTS.md#8-multijugador-partykit--implementado-y-probado-con-2-navegadores-reales) |
| RF-MP-05 | Cuando dos jugadores eligen el mismo planeta, deben distinguirse por su alias mostrado encima del sprite (azul fuerte para uno mismo, gris delgado para los demás, simétrico en cada cliente). | ✅ | [§6.4](./AGENTS.md#64-registro-obligatorio-de-perfil-alias--implementado) |
| RF-MP-06 | Debe existir un chat de texto en vivo entre jugadores de la misma sala, habilitado **únicamente** cuando todos los jugadores presentes son mayores de edad — verificado en el servidor, no solo en el cliente. | ✅ | [§6.5](./AGENTS.md#65-edad-terminos-y-condiciones-y-chat-de-texto-en-vivo--implementado) |
| RF-MP-07 | Cuando un jugador activa su habilidad, los demás jugadores de la sala deben ver una señal visual de que está activa (no solo verlo en su propia sesión). | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-MP-08 | Al derrotar un agujero negro, el nivel alcanzado debe propagarse a todos los jugadores de la sala (nunca bajar el de nadie), junto con un marcador compartido de cuántos agujeros negros ha derrotado el equipo en total. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-MP-09 | Debe existir un panel desplegable, visible solo en modo sala/partida, que muestre las vidas y estrellas actuales de cada jugador del equipo como información. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-MP-10 | Cuando el bono de compañero de Júpiter protege a otro jugador, ese jugador debe ver el mismo indicador visual de escudo que ve Júpiter, para saber que está protegido. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-MP-11 | Mientras un jugador tiene su habilidad activa, cualquier compañero cercano (dentro de rango) debe recibir un beneficio equivalente al de esa habilidad — no solo Júpiter, todas las habilidades. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-MP-12 | El chat de texto y el panel informativo de vidas/estrellas del equipo deben ser translúcidos (para no tapar el juego detrás) y movibles arrastrándolos, con el chat más pequeño en móvil. | ✅ | [§6.5](./AGENTS.md#65-edad-terminos-y-condiciones-y-chat-de-texto-en-vivo--implementado), [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-MP-13 | Salir manualmente de una partida (sin morir) debe reportar el resultado igual que un game over real, para que el jugador y su planeta queden en su historial y en el Top 5 de equipos. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-MP-14 | El Top 5 de equipos debe resaltar el alias del jugador que creó la sala (líder), distinguiéndolo del resto de participantes. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-PERS-06 | Tanto el Top 10 individual como el Top 5 de equipos deben mostrar la fecha en que se alcanzó ese récord. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |
| RF-MOD-01 | Cualquier jugador logueado debe poder denunciar acoso/agresión de otro jugador por su alias, sin depender de estar en un chat de sala activo. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado), [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |

### 1.7 Persistencia y progreso (RF-PERS)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-PERS-01 | Al terminar una partida, el nivel alcanzado y las estrellas recolectadas deben guardarse ligados a la cuenta del jugador. | ✅ | [§7.2](./AGENTS.md#72-guardado-de-partida-fase-6--implementado-y-probado-end-to-end) |
| RF-PERS-02 | Las estrellas deben guardarse de forma incremental cada 5 recolectadas durante la partida, para minimizar la pérdida de progreso si el juego se traba. | ✅ | [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22) |
| RF-PERS-03 | El leaderboard (top 10) de un jugador solo debe actualizarse si el nuevo puntaje supera al anterior. | ✅ | [§7.2](./AGENTS.md#72-guardado-de-partida-fase-6--implementado-y-probado-end-to-end) |
| RF-PERS-04 | El HUD debe reflejar honestamente el estado real del guardado (guardando/guardado/error), nunca asumir éxito en silencio. | ✅ | [§7.2](./AGENTS.md#72-guardado-de-partida-fase-6--implementado-y-probado-end-to-end) |
| RF-PERS-05 | Debe existir un Top 5 de salas/equipos con el nivel récord alcanzado en conjunto, mostrando los planetas/participantes que lo lograron. | ✅ | [§8.2](./AGENTS.md#82-progreso-compartido-en-equipo--implementado) |

### 1.8 Pagos / aportación voluntaria (RF-PAY)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-PAY-01 | El jugador debe poder hacer una aportación voluntaria (monto configurable por admin) mediante Stripe Checkout. | ✅ | [§10](./AGENTS.md#10-pagos-stripe--aportacion-voluntaria--implementada-y-probada-con-un-pago-real) |
| RF-PAY-02 | Al confirmarse el pago, deben acreditarse estrellas de recompensa (cantidad configurable por admin) de forma idempotente. | ✅ | [§10](./AGENTS.md#10-pagos-stripe--aportacion-voluntaria--implementada-y-probada-con-un-pago-real) |
| RF-PAY-03 | El botón de donación debe estar disponible en todo momento durante el juego y en la landing, no solo al perder. | ✅ | [§16 changelog 2026-07-22 "Botón de donación siempre disponible"](./AGENTS.md#16-registro-de-cambios-changelog) |

### 1.9 Panel de administración (RF-ADM)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-ADM-01 | Debe existir un rol `admin` con acceso a un panel protegido, verificado en cada endpoint del servidor (no solo en el cliente). | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-ADM-02 | El admin debe poder editar en runtime: velocidad del jugador, habilidades, Sol, pulsares/estrellas, Agujero Negro, WhatsApp, donación y Términos y Condiciones. | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-ADM-03 | El admin debe poder buscar jugadores por correo, ajustar sus estrellas y corregir su perfil (nombre/apellido/alias). | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-ADM-04 | El admin debe poder listar todos los jugadores paginados y eliminar cuentas (selección múltiple, con confirmación). | ✅ | [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22), [§2.4](./AGENTS.md#24-ronda-de-retroalimentacion-en-vivo-4-2026-07-22) |
| RF-ADM-05 | Debe existir un modo "Ver como jugador/Admin" que permita al admin validar el gate de `/admin` sin necesitar una segunda cuenta. | ✅ | [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22) |
| RF-ADM-06 | El admin debe poder gestionar comentarios/sugerencias de jugadores (marcar como leído = baja lógica, nunca borrado físico). | ✅ | [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22) |
| RF-ADM-07 | El admin debe poder buscar el histórico de chat por sala/alias, con los mensajes marcados como sospechosos priorizados. | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |
| RF-ADM-08 | El admin debe poder revisar denuncias entre jugadores, notificar al denunciante, y aprobar/rechazar (aprobar suma una amonestación). | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |
| RF-ADM-09 | La creación de planetas/habilidades nuevas desde cero queda **fuera de alcance** hasta una especificación futura del usuario. | ⏳ | [§15](./AGENTS.md#15-preguntas-abiertas--riesgos) |
| RF-ADM-10 | El admin debe poder revisar solicitudes de cambio de datos sensibles enviadas por jugadores, en una sección dedicada. | ✅ | [§6.8](./AGENTS.md#68-autoservicio-de-perfil-y-solicitudes-de-cambio-de-datos-sensibles--implementado) |
| RF-ADM-11 | El admin debe poder editar en runtime los parámetros de las habilidades pasivas/activas de cada planeta (velocidad, radios/factores de ralentización, inmunidades a llamaradas, alcance de la lava, radio de repulsión de Saturno, bono de compañero de Júpiter, etc.), no solo su duración/recarga. | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-ADM-12 | La edición de perfil de un jugador debe abrirse en un modal con cada campo etiquetado y con una descripción visible, no como campos en línea sin contexto. | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RF-ADM-13 | El admin debe poder ver y editar (marcar/desmarcar) qué planetas premium tiene desbloqueados un jugador, para poder revocar el acceso si es necesario. | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |

### 1.10 Chat en vivo y moderación (RF-CHAT)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-CHAT-01 | El chat solo debe habilitarse si todos los jugadores de la sala son mayores de edad — verificación real en el servidor de la sala, recalculada en cada mensaje. | ✅ | [§6.5](./AGENTS.md#65-edad-terminos-y-condiciones-y-chat-de-texto-en-vivo--implementado) |
| RF-CHAT-02 | Todo el historial de chat debe guardarse en la base de datos (fecha/hora, sala, jugador, mensaje) para consulta exclusiva del administrador. | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |
| RF-CHAT-03 | Los mensajes con indicios de riesgo (posible teléfono, dirección, solicitud de contacto externo, groserías) deben marcarse automáticamente como prioritarios para revisión humana, sin bloquearse ni censurarse en vivo. | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |
| RF-CHAT-04 | El jugador debe poder denunciar un mensaje/alias específico, indicando fecha y hora del incidente (prellenadas si se denuncia desde el chat) y una descripción. | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |

### 1.11 Denuncias y amonestaciones (RF-REP)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-REP-01 | Solo debe haber dos amonestaciones ("avisos") antes de que la tercera inhabilite la cuenta permanentemente. | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |
| RF-REP-02 | Toda amonestación debe requerir aprobación humana de un administrador — nunca automática solo por recibir una denuncia. | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |
| RF-REP-03 | El jugador denunciante y el denunciado deben recibir notificaciones in-app en cada paso relevante (solicitud en atención, amonestación recibida, cuenta inhabilitada). | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |
| RF-REP-04 | Una cuenta inhabilitada debe bloquear el uso de toda la aplicación, con la única acción disponible de cerrar sesión. | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |

### 1.12 Comentarios y sugerencias (RF-FB)

| ID | Requisito | Estado | Detalle |
|---|---|---|---|
| RF-FB-01 | Cualquier jugador con sesión debe poder dejar un comentario con un tono (positivo/neutro/negativo). | ✅ | [§2.3](./AGENTS.md#23-ronda-de-retroalimentacion-en-vivo-3-2026-07-22) |

---

## 2. Requisitos No Funcionales (RNF)

| ID | Categoría | Requisito | Estado | Detalle |
|---|---|---|---|---|
| RNF-CODE-01 | Código | Prohibido `any` en TypeScript; ESLint estricto obligatorio antes de cada commit. | ✅ | [§12](./AGENTS.md#12-reglas-de-codigo-resumen-aplicable-a-este-proyecto) |
| RNF-CODE-02 | Código | Todo código debe llevar comentarios en **español** explicando qué hace y, cuando aplique, el **porqué** (valores, banderas, fixes). | ✅ | Instrucción explícita del usuario (2026-07-22), aplicada en todo el código de esta sesión. |
| RNF-CODE-03 | Código | El dinero siempre se almacena/calcula en centavos (enteros); el formato de visualización se aplica solo al renderizar. | ✅ | [§12](./AGENTS.md#12-reglas-de-codigo-resumen-aplicable-a-este-proyecto) |
| RNF-CODE-04 | Código | Toda operación criptográfica (tokens, firmas de webhook) debe usar librerías nativas/oficiales, nunca implementación propia. | ✅ | [§12](./AGENTS.md#12-reglas-de-codigo-resumen-aplicable-a-este-proyecto) |
| RNF-I18N-01 | Internacionalización | Prohibidas las cadenas de texto de cara al usuario "hardcodeadas" — todo vía `next-intl` (es/en). | ✅ | [§12](./AGENTS.md#12-reglas-de-codigo-resumen-aplicable-a-este-proyecto) |
| RNF-UX-01 | Responsive | Todo componente/pantalla debe ser adaptativo desde celular hasta escritorio, con el control correcto por dispositivo (teclado/clic en PC, táctil en móvil). | ✅ | [§3.1](./AGENTS.md#31-definition-of-done--por-cada-componentepagina-nueva) |
| RNF-UX-02 | Diseño visual | Toda pantalla/componente nuevo debe pasar por la skill `frontend-design` — sin plantillas genéricas, paleta derivada de investigación real (SolarBalls). | ✅ | [§1.1](./AGENTS.md#11-landing-page--requisito-de-diseno-profesional), [§3](./AGENTS.md#3-estandares-obligatorios-de-codificacion-y-diseno-de-componentes) |
| RNF-UX-03 | Errores de UI | Todo error capturado en cliente debe mostrarse en un componente de notificación (Toast) minimalista con código, detalle expandible y cierre explícito. | ⏳ | Deuda técnica documentada — ver [§15](./AGENTS.md#15-preguntas-abiertas--riesgos) (pantallas actuales usan texto de estado inline, misma función pero no el patrón visual exacto). |
| RNF-SEC-01 | Seguridad | Toda ruta `/api/admin/*` debe verificar el rol real en el servidor en cada request, nunca confiar solo en la UI. | ✅ | [§9](./AGENTS.md#9-panel-de-administracion--implementado-y-probado) |
| RNF-SEC-02 | Seguridad | Las llamadas servicio-a-servicio (PartyKit → Next.js) deben autenticarse con un secreto compartido, no con sesión de usuario. | ✅ | [§6.6](./AGENTS.md#66-denuncias-entre-jugadores-y-moderacion-del-chat--implementado) |
| RNF-SEC-03 | Seguridad | Endpoints de auth sensibles (verificación de código) deben tener rate limiting por IP. | ✅ | [§6.3](./AGENTS.md#63-login-por-codigo-de-6-digitos--implementado-reemplaza-el-token-largo) |
| RNF-PRIV-01 | Privacidad | La fecha de nacimiento exacta nunca debe exponerse al cliente — solo el booleano `isAdult` ya calculado en el servidor. | ✅ | [§6.5](./AGENTS.md#65-edad-terminos-y-condiciones-y-chat-de-texto-en-vivo--implementado) |
| RNF-PRIV-02 | Privacidad | Los datos de edad son autodeclarados (no verificados con identificación oficial), documentado honestamente en los Términos y Condiciones. | ✅ | [§6.5](./AGENTS.md#65-edad-terminos-y-condiciones-y-chat-de-texto-en-vivo--implementado) |
| RNF-PERSIST-01 | Persistencia | MongoDB vía singleton cacheado (`lib/db.ts`), compatible con el modelo serverless de Vercel. | ✅ | [§7](./AGENTS.md#7-persistencia--decision-y-justificacion) |
| RNF-PERSIST-02 | Persistencia | Todo cambio de esquema que agregue un campo obligatorio debe ir acompañado de su migración aditiva corrida de inmediato contra la base de datos real (lección aprendida — ver `RETROSPECTIVA.md`). | ✅ | `RETROSPECTIVA.md` |
| RNF-PERF-01 | Rendimiento | Objetivo de carga: 100 conexiones WebSocket concurrentes (25 salas de 4) sostenidas 15 minutos sin degradación. | ⏳ | [§11](./AGENTS.md#11-testing-y-qa) — no ejecutado todavía (Fase 9, QA). |
| RNF-PERF-02 | Rendimiento | El motor de juego no debe generar fugas de memoria por entidades removidas del canvas sin liberar sus recursos de PixiJS. | ✅ | [§2.1](./AGENTS.md#21-ronda-de-retroalimentacion-en-vivo-post-fase-8-2026-07-22) (bug real encontrado y corregido) |
| RNF-COMPAT-01 | Compatibilidad | Navegadores validados: Chrome 120+, Firefox 118+, Edge 120+. | ✅ | [`INFRA.md`](./INFRA.md) |
| RNF-DEPLOY-01 | Despliegue | Antes de producción, Mailpit debe sustituirse por un proveedor de email real; sin ello el login por Magic Link no funciona para usuarios reales. | ⏳ | [§6.1](./AGENTS.md#61-advertencia-critica-mailpit-en-produccion) |
| RNF-DEPLOY-02 | Despliegue | Antes de producción, el envío de WhatsApp (recuperación de cuenta) requiere credenciales reales de WhatsApp Cloud API. | ⏳ | [§6.7](./AGENTS.md#67-recuperacion-de-cuenta-por-alias--fecha-de-nacimiento--implementado) |
| RNF-OBS-01 | Observabilidad | Todo error/promesa no atrapada del cliente y el ciclo de vida del motor de juego deben quedar registrados en un log del servidor, para diagnóstico sin acceso a la consola del dispositivo del jugador. | ✅ | [§2.2](./AGENTS.md#22-ronda-de-retroalimentacion-en-vivo-2-2026-07-22) |
| RNF-UX-04 | Diseño visual | Todo modal/overlay nuevo debe incluir un botón de cierre explícito, salvo indicación contraria del usuario. | ✅ | [§2.6](./AGENTS.md#26-ronda-de-retroalimentacion-en-vivo-6-2026-07-24) |
| RNF-UX-05 | Diseño visual | Ningún modal debe renderizarse detrás de otro elemento de la página (ej. el carrusel de planetas) sin importar su z-index declarado; los modales anidados dentro de un contenedor con posición fija deben escapar su contexto de apilamiento. | ✅ | [§2.6](./AGENTS.md#26-ronda-de-retroalimentacion-en-vivo-6-2026-07-24) — bug real de stacking-context corregido, ver `RETROSPECTIVA.md` |

---

## 3. Fuera de alcance (explícitamente confirmado con el usuario)

- Creación de planetas/habilidades nuevas desde cero vía admin — ver [§15](./AGENTS.md#15-preguntas-abiertas--riesgos).
- Traefik, HashiCorp Vault, SonarQube/Semgrep/Trivy, Elasticsearch/Kibana, storage S3/RustFS — ver [§0](./AGENTS.md#0-decisiones-de-gobernanza-confirmadas-con-el-usuario-2026-07-21) (regla de exclusión de tecnologías).
- Patrón de Toast estandarizado (Framer Motion) — deuda técnica para Fase 9, ver [§15](./AGENTS.md#15-preguntas-abiertas--riesgos).
- Reconexión con gracia en multijugador tras desconexión — ver [§8](./AGENTS.md#8-multijugador-partykit--implementado-y-probado-con-2-navegadores-reales).
