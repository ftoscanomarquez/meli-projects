# QUICK-START.md — Planet Scape of the Solar System

> Comandos CLI bajo demanda y estructura del proyecto. Sincronizado con [`AGENTS.md`](./AGENTS.md) — ver regla de sincronización en [AGENTS.md §0.1](./AGENTS.md#01-regla-de-sincronizacion-de-documentacion).
> Estado actual: **Fase 8 (Panel de Administración) — implementada y probada real de punta a punta** (2026-07-22): cuenta promovida vía `npm run seed:admin`, `/admin` verificado (rechaza no-admin, acepta admin), edición de balance (`game_config`) reflejada en una partida nueva sin redeploy, búsqueda de jugador + ajuste de estrellas. La donación (Fase 7) ahora lee mín/paso/máx/recompensa de `game_config.donation` en vez de constantes de código. Se agregó además un directorio de salas abiertas en el lobby (segundo party de PartyKit) con pantalla de transición "Creando sesión del juego...". Alcance confirmado con el usuario: la creación de planetas/habilidades nuevas queda pendiente de una especificación futura, no forma parte de esta fase. **Ronda de retroalimentación en vivo post-Fase 8** (2026-07-22, ver AGENTS.md §2.1): planetas premium Júpiter/Saturno seleccionables y comprables con estrellas, control de mouse/touchpad por seguimiento de cursor, `DEV_AUTO_LOGIN` para pruebas desde móvil, selector de idioma, música de fondo con 4 melodías, fuga de memoria de PixiJS corregida, escala adaptativa de entidades en móvil, entre otros — detalle completo en AGENTS.md §16 y `RETROSPECTIVA.md`. Próxima fase: 9 — QA y Endurecimiento. Este documento se actualiza a medida que cada comando/carpeta se materializa en el código.

---

## Estructura del Proyecto

`✅` = ya implementado. Sin marca = planeado para una fase posterior (mayormente el catálogo dinámico de planetas/habilidades, pendiente de una especificación futura del usuario).

```
planet-scape/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # ✅ rutas con next-intl (es/en)
│   │   ├── layout.tsx             # ✅ html/body, NextIntlClientProvider, GlobalContext + sesión
│   │   ├── page.tsx               # ✅ placeholder Fase 0 + AuthStatus (Fase 2 = landing real)
│   │   ├── (auth)/                # login/verify-request/error custom (aún usa páginas por defecto de Auth.js)
│   │   ├── (game)/play/           # ✅ ruta de partida single-player (?planet=mercury|venus|earth|mars)
│   │   ├── (game)/lobby/          # ✅ crear/unirse a sala + lista de salas abiertas (?planet=X[&room=Y])
│   │   └── admin/                 # ✅ panel de administración (gate de rol + AdminDashboard)
│   └── api/
│       ├── auth/[...nextauth]/    # ✅ handlers de Auth.js
│       ├── space-facts/random/    # ⏳ no implementado — la rotación real vive en proxy.ts (ver AGENTS.md §5.3)
│       ├── player/me/
│       ├── rooms/
│       ├── sessions/complete/     # ✅ guarda game_sessions/star_transactions/players.stars/leaderboard
│       ├── leaderboard/           # ✅ top 10, force-dynamic
│       ├── donations/checkout/    # ✅ crea Stripe Checkout Session (valida rango contra game_config.donation)
│       ├── webhooks/stripe/       # ✅ firma verificada, idempotente, recompensa desde game_config.donation
│       ├── planets/unlock/        # ✅ POST — compra Júpiter/Saturno con estrellas (ver AGENTS.md §5.2)
│       ├── client-log/            # ✅ POST — trazabilidad del navegador hacia logs/app.log (ver AGENTS.md §2.2)
│       ├── admin/config/          # ✅ GET/PUT game_config — rol admin
│       ├── admin/players/         # ✅ GET búsqueda por email — rol admin
│       ├── admin/players/[id]/stars/ # ✅ PATCH ajuste de estrellas (delta) — rol admin
│       ├── admin/players/[id]/profile/ # ✅ PATCH corrige nombre/apellido/alias — rol admin
│       ├── profile/check-alias/   # ✅ GET disponibilidad del alias + sugerencia (ver AGENTS.md §6.4)
│       ├── profile/complete/      # ✅ POST registro obligatorio de nombre/apellido/alias
│       ├── sessions/star-increment/ # ✅ POST guardado silencioso cada 5 estrellas en vivo (ver AGENTS.md §2.3)
│       └── health/                # ✅
├── components/
│   ├── auth/AuthStatus.tsx        # ✅ widget de login/logout (fixed en desktop, en flujo en mobile) + selector de idioma
│   ├── shared/LanguageSwitcher.tsx # ✅ toggle ES/EN (next-intl usePathname/useRouter)
│   ├── shared/DonationButton.tsx  # ✅ botón de donación siempre disponible (HUD del juego + landing), abre DonationPrompt en modal
│   ├── shared/ClientErrorReporter.tsx # ✅ captura errores/promesas no atrapadas de toda la app hacia logs/app.log
│   ├── shared/AdminViewToggle.tsx # ✅ selector "ver como jugador/admin" (cookie de vista, ver lib/actions/adminView.ts)
│   ├── auth/ProfileOnboarding.tsx # ✅ registro obligatorio de alias/nombre/apellido, montado en layout.tsx (ver AGENTS.md §6.4)
│   ├── characters/                # ✅ SVG (React, landing): Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn (falta Neptune)
│   ├── landing/                   # ✅ SpaceFactBubble (firma visual), PlanetSelector (arco + CTA + desbloqueo premium), LeaderboardWidget (top 10)
│   ├── game/                      # ✅ GameCanvas (gatea el montaje con MusicPicker), GameCanvasLoader (dynamic ssr:false), GameHud (habilidad + ataque Agujero Negro separados), MusicPicker (elegir tema o subir canción propia), DonationPrompt
│   ├── lobby/                     # ✅ RoomEntry (crear/unirse + salas abiertas en vivo), RoomView (roster+countdown+"creando sesión"+juego), Lobby (switcher)
│   ├── admin/                     # ✅ AdminDashboard (+ "Salir del modo Admin"), AdminConfigForm (balance, números con comas), AdminPlayerSearch (estrellas + editar perfil + listar todos paginado), FormattedNumberInput
│   └── ui/                        # ⏳ toasts, modales, botones (patrón "Toast minimalista" de AGENTS.md §12.11 aún no construido — las pantallas actuales usan texto de estado inline, ver MEJORAS.md)
├── engine/                        # ✅ Motor de juego (PixiJS 8 + Zustand) — Fase 3-5 + ronda de retroalimentación en vivo
│   ├── entities/                  # ✅ Sun, BlackHole (crece con el tiempo, no expira solo), Player, FieldObject (asteroide/pulsar/estrella)
│   ├── systems/spawnSystem.ts     # ✅ variedad de tamaños de asteroide (ASTEROID_SIZE_TIERS), dificultad por nivel
│   ├── particles/ParticlePool.ts  # ✅ sistema propio (no @pixi/particle-emitter, ver RETROSPECTIVA.md) — llamaradas sin desvanecer, rastro de Mercurio
│   ├── audio/backgroundMusic.ts   # ✅ música procedural (Web Audio API), 4 temas rotativos, sin librerías externas
│   ├── abilities/                 # ✅ types.ts (contrato + TimedAbility base), mercury/venus/earth/mars/jupiter/saturnAbility.ts — los 6 planetas de lanzamiento tienen habilidad implementada
│   ├── controls/InputController.ts # ✅ teclado (flechas) + mouse (seguir cursor, sin clic) + arrastre táctil (touch)
│   ├── multiplayer/types.ts       # ✅ contrato MultiplayerConfig entre GameEngine y lib/multiplayer/
│   ├── rng.ts                     # ✅ RNG con semilla (Mulberry32) — mundo determinista compartido en multijugador
│   ├── characterSvg.ts            # ✅ SVG de planetas como texturas de PixiJS (mismo diseño que components/characters); tipo PlanetKey = StarterPlanetKey | PremiumPlanetKey
│   ├── textures.ts                # ✅ texturas cacheadas (asteroides, pulsares, estrella)
│   └── store/gameStore.ts         # ✅ store Zustand del HUD (nunca posiciones por frame); initialStars/musicMuted persisten entre reset()
├── party/                         # ✅ PartyKit: gameRoom.ts (lobby+relevo, party "main"), directory.ts (salas abiertas, party "directory", sala fija "global"), messages.ts (protocolo compartido)
├── i18n/                          # ✅ routing.ts, request.ts, navigation.ts (next-intl)
├── proxy.ts                       # ✅ reemplaza middleware.ts (Next.js 16) — locale + rate limiting + rotación de dato curioso
├── lib/
│   ├── multiplayer/useRoomConnection.ts # ✅ hook de conexión a la sala (partysocket/react) — incluye la fase "starting" (creando sesión)
│   ├── multiplayer/useRoomDirectory.ts  # ✅ hook de la lista de salas abiertas en vivo (party "directory")
│   ├── gameConfig.ts              # ✅ getGameConfig() — lectura sin caché de game_config (Server Components)
│   ├── adminGuard.ts              # ✅ requireAdminSession() — guard compartido de /api/admin/*
│   ├── db.ts                      # ✅ singleton de conexión MongoDB (+ clientPromise para el adapter)
│   ├── logger.ts                  # ✅ Pino (stdout + logs/app.log en dev)
│   ├── auth.ts                    # ✅ configuración Auth.js (Magic Link, adapter, callbacks) — redirect callback confía en TRUSTED_DEV_REDIRECT_ORIGINS en dev
│   ├── requestOrigin.ts           # ✅ getRequestOrigin(request) — origen real desde headers, no request.url (ver RETROSPECTIVA.md)
│   ├── actions/auth.ts             # ✅ Server Actions: requestMagicLink (con rama DEV_AUTO_LOGIN), signOutAction (sin redirect propio)
│   ├── dev/mailpitAutoLogin.ts    # ✅ solo dev — sondea la API de Mailpit para automatizar el clic del Magic Link (ver AGENTS.md §6.2)
│   ├── mail/                      # ✅ plantilla Handlebars + envío del correo de Magic Link
│   ├── context/GlobalContext.tsx  # ✅ sesión (incluye unlockedPlanets)/locale — nunca el loop de 60 FPS (eso es Zustand)
│   ├── spaceFacts.ts              # ✅ lookup directo a Mongo por key (Server Component)
│   ├── spaceFacts.constants.ts    # ✅ constantes compartidas proxy.ts ↔ page.tsx
│   ├── leaderboard.ts             # ✅ top 10 directo a Mongo (Server Component, LeaderboardWidget)
│   ├── score.ts                   # ✅ fórmula de puntaje: level*100 + estrellas
│   ├── planetUnlocks.ts           # ✅ PLANET_UNLOCK_COSTS (jupiter:1000, saturn:1200) — ver AGENTS.md §5.2
│   ├── planetAccess.ts            # ✅ canPlayPlanet() — guard server-side en /play y /lobby
│   ├── schemas/                   # ✅ Zod real: gameSession, starTransaction, leaderboard, gameConfig, admin, donation (player/planet/ability dinámicos pendientes)
│   ├── clientLog.ts                # ✅ manda eventos del navegador al logger del servidor (logs/app.log) — ver AGENTS.md §2.2
│   └── resilience/rateLimit.ts    # ✅ rate limiter (memoria / Upstash Redis)
├── types/next-auth.d.ts           # ✅ augmentación de tipos de Session/AdapterUser
├── messages/                      # ✅ next-intl: es.json, en.json (namespaces Metadata/Auth/Landing/Planets)
├── scripts/
│   └── seeds/
│       ├── seed-schema.ts         # ✅ índices (players.email, leaderboard.bestScore/playerId, star_transactions/game_sessions.playerId)
│       ├── seed-abilities.ts
│       ├── seed-planets.ts
│       ├── seed-config.ts         # ✅ siembra los 100 space_facts + game_config inicial (idempotente)
│       ├── data/spaceFacts.json   # ✅ 100 curiosidades es/en
│       ├── seed-data.ts
│       └── promote-admin.ts       # ✅ npm run seed:admin -- --email=... — promueve a role=admin
├── tests/
│   ├── unit/                      # Vitest
│   ├── e2e/                       # Playwright
│   └── postman/                   # colección + entornos + Newman
├── logs/                          # ✅ app.log (desarrollo local)
├── docker-compose.yml             # ✅ MongoDB + Mailpit (referencia — en esta máquina se reutilizan contenedores compartidos, ver RETROSPECTIVA.md)
├── .env.example                   # ✅
├── AGENTS.md
├── QUICK-START.md
└── PROMPT.md
```

---

## Infraestructura Local

```bash
# Levantar MongoDB + Mailpit
docker compose up -d

# Ver logs de los contenedores
docker compose logs -f

# Apagar
docker compose down

# UI de Mailpit (ver correos de Magic Link capturados)
# http://localhost:8025  (admin / magiclink123)
```

## Semillas de Base de Datos

```bash
npm run seed:schema   # crea colecciones e índices
npm run seed:config   # inserta game_config inicial + 100 space_facts
npm run seed:data     # datos mock (jugadores, sesiones, leaderboard)
npm run seed          # ejecuta las tres en orden
npm run seed:admin -- --email=tu-email@ejemplo.com   # promueve un jugador existente a role=admin
```

## Desarrollo

```bash
npm run dev            # Next.js dev server
npx partykit dev       # ✅ servidor PartyKit en local (multijugador) — correr ambos en paralelo (2 terminales)
```

El lobby (`/lobby?planet=mercury`) necesita `partykit dev` corriendo en `localhost:1999` (`NEXT_PUBLIC_PARTYKIT_HOST`, ver `.env.local`). Sin él, la conexión de sala falla — el modo solo (`/play?planet=mercury`) no lo necesita. `partykit.json` define dos parties (`main` y `directory`, ver AGENTS.md §8.1) — ambos corren dentro del mismo proceso de `partykit dev`, no hace falta nada extra para el directorio de salas abiertas.

**Chat en vivo + moderación (ver AGENTS.md §6.5/§6.6)**: `party/gameRoom.ts` persiste el histórico de chat llamando de vuelta a la app de Next.js (`POST /api/chat/log`), autenticado con un secreto compartido. El runtime de `partykit dev` **no** lee `.env.local` — necesita su propio `party/.env` (no versionado, mismo valor que `PARTYKIT_SHARED_SECRET`/`APP_ORIGIN` en `.env.local`):
```env
PARTYKIT_SHARED_SECRET=<mismo valor que .env.local>
APP_ORIGIN=http://localhost:3000
```
Sin ese archivo, el chat en vivo sigue funcionando entre jugadores (el reenvío ocurre en el servidor de la sala, no depende de la app de Next.js) pero **no queda ningún histórico guardado** para el panel de moderación del admin.

**Recuperación de cuenta por WhatsApp (ver AGENTS.md §6.7)**: `WHATSAPP_API_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` (WhatsApp Cloud API de Meta) son opcionales en desarrollo — sin ellos, `lib/whatsapp.ts` solo registra en el log que se habría enviado el mensaje (mismo espíritu que Mailpit para el Magic Link, ver AGENTS.md §6.1). Obligatorio darlos de alta antes de producción.

**Login automático en desarrollo (`DEV_AUTO_LOGIN`)** — para probar desde un celular en la misma red LAN sin acceder al Mailpit del escritorio (ver AGENTS.md §6.2): en `.env.local` poner `DEV_AUTO_LOGIN=true` (además de `NODE_ENV` distinto de `production`, ya el caso en `npm run dev`) y asegurarse de que `EMAIL_SERVER_USER`/`EMAIL_SERVER_PASSWORD` coincidan con las credenciales de la API de Mailpit (`admin`/`magiclink123`). Con esto activo, pedir el Magic Link entra directo sin revisar el correo — nunca activar esta variable en producción.

**Probar desde un celular en la misma red** — si el dev server se abre por IP (`http://192.168.x.x:3000`) en vez de `localhost`, agregar esa IP a `allowedDevOrigins` en `next.config.ts` (Next.js no acepta CIDR, solo hosts exactos o comodines de subdominio) para que el HMR no falle.

**Troubleshooting (Windows) — "sala vacía" / "0 participantes" / "0/4 jugadores" al crear una sala nueva**: si `partykit dev` arranca en un puerto distinto a `1999` (ej. `1407`), o si tras editar `party/*.ts` con el dev server corriendo el party `directory` empieza a responder `404 Party directory not found` aunque `main` siga funcionando, es casi siempre un proceso `workerd.exe` huérfano de una sesión anterior que sigue ocupando el puerto — ver `RETROSPECTIVA.md`. Síntoma típico reportado por el usuario (2026-07-22 y recurrente): al crear una sala nueva (aunque nadie más se haya unido todavía) aparece un error como si la sala estuviera vacía/llena/rota. **No es un bug de código del proyecto** — es una limitación conocida de la herramienta `partykit dev` en Windows. Solución: cerrar el proceso huérfano y reiniciar `partykit dev` limpio (esto reinicia el estado en memoria de la sala; no requiere tocar Mongo ni ningún dato del jugador).
```powershell
netstat -ano | findstr :1999          # confirma qué PID tiene el puerto
tasklist /FI "PID eq <PID>"           # debería mostrar workerd.exe
taskkill /PID <PID> /F                # y volver a correr `npx partykit dev`
```

## Stripe (Fase 7) ✅ implementado y probado con un pago real de principio a fin

Claves de prueba (`pk_test_`/`sk_test_`) en `.env.local` (no versionado). **Verificar que una llave secreta es válida antes de usarla** (nos pasó una vez que no lo era, ver `RETROSPECTIVA.md`):

```bash
curl -s https://api.stripe.com/v1/account -u "TU_STRIPE_SECRET_KEY:"
# si responde {"error":{"message":"Invalid API Key provided..."}} la llave está mal — pedir una nueva.
# si responde {"id":"acct_...", ...} es válida y ese "id" es la cuenta real.
```

### Levantar el webhook en desarrollo (Stripe CLI)

1. Instalar la [Stripe CLI](https://docs.stripe.com/stripe-cli) (una sola vez):
   ```bash
   # Windows (scoop)
   scoop install stripe
   # o descargar el binario desde https://github.com/stripe/stripe-cli/releases
   ```
2. Iniciar sesión (una sola vez, abre el navegador para autorizar). **Importante**: el CLI se loguea a UNA cuenta de Stripe — debe ser la MISMA cuenta de las claves en `.env.local`, si no, los webhooks nunca llegan (`stripe config --list` muestra a qué cuenta está logueado ahora mismo, comparar el `account_id` contra el de arriba):
   ```bash
   stripe login
   ```
3. Con `npm run dev` (o `npm run start`) corriendo, en **otra terminal** dejar esto corriendo mientras se prueba:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Imprime `Your webhook signing secret is whsec_...` — copiarlo a `STRIPE_WEBHOOK_SECRET` en `.env.local` y reiniciar el servidor de Next.js para que lo recoja. Para consultar el secreto sin dejar la sesión abierta: `stripe listen --print-secret` (para la cuenta de este proyecto resultó ser el mismo valor cada vez que se corrió, pero no asumir esto en general — siempre confirmar con `--print-secret` o el mensaje de `stripe listen`).
4. Prueba rápida sin pasar por la UI (evento sintético — **no** llega con `metadata.playerId` real, así que el webhook lo acepta con `200` pero no acredita estrellas; sirve solo para confirmar que la firma verifica):
   ```bash
   stripe trigger checkout.session.completed
   ```
5. **Prueba real de punta a punta** (la que de verdad valida todo el flujo): loguearse en la app, terminar una partida, mover el slider de aportación y pagar con una [tarjeta de prueba](https://docs.stripe.com/testing#cards) (`4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC de 3 dígitos, cualquier código postal). Confirmar en la terminal de `stripe listen` que aparecen los eventos (`charge.succeeded`, `payment_intent.created`/`succeeded`, `checkout.session.completed`, `charge.updated`) todos respondidos con `[200]`, y que las estrellas del jugador subieron 200 (ver esquina superior del HUD o `players.stars` en Mongo).

### Webhook en producción

1. En el [Dashboard de Stripe](https://dashboard.stripe.com/webhooks) (modo Live, no Test) → **Add an endpoint**.
2. URL del endpoint: `https://<tu-dominio>/api/webhooks/stripe`.
3. Eventos a escuchar: como mínimo `checkout.session.completed` (el webhook ignora cualquier otro tipo con `200`, así que suscribir "todos los eventos" también es seguro si se prefiere no mantener la lista).
4. Stripe muestra el **Signing secret** de ese endpoint (`whsec_...`) — es **fijo** (no cambia entre despliegues, a diferencia del de `stripe listen` en desarrollo) y va en la variable `STRIPE_WEBHOOK_SECRET` de las Environment Variables de Vercel (nunca en un archivo versionado).
5. Cambiar también `STRIPE_SECRET_KEY`/`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` a las claves **Live** (`sk_live_`/`pk_live_`) — nunca reutilizar las de Test en producción, ver checklist completo en [`DEPLOYMENT.md`](./DEPLOYMENT.md#2-checklist-previo-al-primer-despliegue).
6. Verificar con un cobro real pequeño (o el modo Test del Dashboard de producción, si Stripe lo permite en la cuenta) antes de anunciar la función como disponible.

## Calidad de Código

```bash
npm run lint            # ESLint estricto
npm run typecheck       # tsc --noEmit (prohibido `any`)
npm run format           # Prettier
```

## Pruebas

```bash
npm run test             # Vitest — unidades (colisiones, Zod, reducers Zustand)
npm run test:watch       # Vitest en modo watch

npm run test:e2e         # Playwright — flujos E2E (login, partida, donación)
npm run test:e2e:report  # abre el reporte HTML de Playwright

npm run test:api         # Newman contra tests/postman/ (colección + entorno local)
npm run test:api:report  # genera reporte HTML (newman-reporter-htmlextra)

npm run test:load        # k6 — 100 conexiones WebSocket concurrentes / 15 min (ver AGENTS.md §16)
```

## Build y Despliegue

```bash
npm run build            # SOLO al cerrar una fase completa (regla AGENTS.md §20.9)
npm run start             # servidor de producción local

npx partykit login         # una sola vez — cuenta gratuita de PartyKit vía GitHub
npx partykit deploy       # despliega el servidor multijugador (independiente de Vercel)
vercel --prod              # despliega la app Next.js
```

**`npx partykit deploy` — aclaración importante** (2026-07-23, duda real del usuario: "nunca me dijiste que necesitaba cloudflare para eso... no tengo un vps?"): esto **no** requiere una cuenta propia de Cloudflare ni un VPS. PartyKit es un servicio ya hospedado (igual que Vercel/Stripe/Atlas) — por debajo corre sobre la infraestructura de Cloudflare, pero es la cuenta de Cloudflare de PartyKit, no la del proyecto. Solo hace falta `npx partykit login` (gratis, vía GitHub) antes del primer `deploy`; el comando devuelve automáticamente una URL HTTPS lista (tipo `planet-scape.<usuario>.partykit.dev`, sin configurar DNS ni certificados) — esa es la que va en `NEXT_PUBLIC_PARTYKIT_HOST` en Vercel. Mapear un dominio propio (ej. si ya tienes uno en Cloudflare) a esa URL es posible desde el dashboard de PartyKit, pero es opcional/cosmético — ver detalle completo en [`DEPLOYMENT.md` §3.2](./DEPLOYMENT.md#32-servidor-multijugador).

---

## Notas

- Comandos ya implementados en `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `seed:*`. `npx partykit dev`/`deploy` funcionan directo desde el paquete `partykit` instalado (no necesitan script propio en `package.json`). Los de test (`test`, `test:e2e`, `test:api`, `test:load`) se agregan en su fase correspondiente (9).
- Los contenedores de `docker-compose.yml` pueden ya estar corriendo de forma compartida con otro proyecto local en esta máquina (mismos puertos/credenciales) — ver incidente registrado en [`RETROSPECTIVA.md`](./RETROSPECTIVA.md). `docker compose up -d` fallará con "port is already allocated" si es el caso; no es un error bloqueante, solo confirma que el Mongo/Mailpit compartido ya está disponible.
- Cualquier cambio a esta estructura o a estos comandos debe reflejarse aquí **y** en `AGENTS.md` (registrar en el Changelog, §16), según la regla de sincronización.
