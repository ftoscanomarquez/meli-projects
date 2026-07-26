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
npm run seed:schema   # crea colecciones e índices (estructura, nunca datos)
npm run seed:config   # inserta game_config inicial + 100 space_facts (balance del juego)
npm run seed:admins   # crea/asegura las 2 cuentas admin iniciales (Francisco/Melissa), sin requerir login previo
npm run seed          # ejecuta las tres en orden (schema → config → admins)
npm run seed:admin -- --email=tu-email@ejemplo.com   # promueve CUALQUIER OTRO jugador ya existente a role=admin
```

> **2026-07-25**: `seed:data`/`seed:abilities`/`seed:planets` fueron removidos del `package.json` — referenciaban scripts que nunca se implementaron (pertenecían al catálogo dinámico de planetas/habilidades, sigue fuera de alcance, ver `AGENTS.md` §15). `npm run seed` ahora solo encadena lo que existe de verdad. Ver detalle completo en `docs/PRE-PROD.md` Fase 1.

## Desarrollo

```bash
npm run dev            # Next.js dev server
npm run party:dev       # ✅ servidor multijugador en local (wrangler dev --port 1999 --ip 0.0.0.0) — correr ambos en paralelo (2 terminales)
```

El flag `--ip 0.0.0.0` ya viene incluido en el script (ver troubleshooting más abajo, 2026-07-25) — necesario para que el celular en la misma red LAN pueda conectarse; sin él, `wrangler dev` solo escucha en `127.0.0.1` por defecto.

> **2026-07-25 — migración de PartyKit a Wrangler/`partyserver`** (ver `docs/PRE-PROD.md` Fase 5 y `RETROSPECTIVA.md` para el análisis completo): el CLI de la plataforma gestionada `partykit` (paquete npm `partykit`, comandos `npx partykit dev`/`login`/`deploy`) quedó **descontinuado** — Cloudflare compró PartyKit en 2024 y el CLI viejo no soporta el requisito nuevo de Cloudflare de migraciones `new_sqlite_classes` para Durable Objects en el plan gratuito. El proyecto ahora corre directo sobre **Wrangler** (CLI oficial de Cloudflare) + el paquete `partyserver` (mismo equipo, misma forma de API que ya usaba `party/gameRoom.ts`/`party/directory.ts` — casi sin cambios de lógica, solo de "cómo se instancia y enruta el objeto"). `partykit.json` fue reemplazado por `wrangler.jsonc`; hay un `party/worker.ts` nuevo como punto de entrada (usa `routePartykitRequest` de `partyserver`, que entiende exactamente la misma forma de URL que el cliente ya usaba — el cliente, `lib/multiplayer/useRoomConnection.ts`/`partykitHost.ts`, **no cambió**).

El lobby (`/lobby?planet=mercury`) necesita `wrangler dev` corriendo en `localhost:1999` (`NEXT_PUBLIC_PARTYKIT_HOST`, ver `.env.local` — el nombre de la variable no cambió, sigue siendo válido conceptualmente). Sin él, la conexión de sala falla — el modo solo (`/play?planet=mercury`) no lo necesita. `wrangler.jsonc` define dos Durable Objects (`MAIN` → `GameRoom`, `DIRECTORY` → `Directory`, ver AGENTS.md §8.1) — ambos corren dentro del mismo proceso de `wrangler dev`, no hace falta nada extra para el directorio de salas abiertas.

**TypeScript separado para `party/`**: el código del Worker corre en el runtime de Cloudflare (Durable Objects), no en Node.js/Next.js — usa sus propios tipos (`@cloudflare/workers-types`), que **no deben mezclarse** con el `tsconfig.json` de la app (rompe el tipado de `Response.json()` en toda la app si se hace global — ver `RETROSPECTIVA.md`). Por eso `party/` tiene su propio `party/tsconfig.json`, excluido del `tsconfig.json` raíz, con su propio script:

```bash
npm run typecheck        # app Next.js (tsconfig.json raíz, excluye party/)
npm run typecheck:party  # solo party/ (party/tsconfig.json)
```

**Chat en vivo + moderación (ver AGENTS.md §6.5/§6.6)**: `party/gameRoom.ts` persiste el histórico de chat llamando de vuelta a la app de Next.js (`POST /api/chat/log`), autenticado con un secreto compartido. A diferencia del `partykit dev` original, **`wrangler dev` sí lee `.env.local` automáticamente** — ya no hace falta un `party/.env` aparte; basta con que `PARTYKIT_SHARED_SECRET`/`APP_ORIGIN` estén en el `.env.local` de siempre. (Nota de higiene: esto también significa que TODAS las variables de `.env.local` — Mongo, Stripe, Resend — quedan visibles como bindings del Worker en el log de arranque de `wrangler dev`, aunque el Worker solo use un par de ellas; es solo ruido de desarrollo local, no un problema de producción, donde los secrets se configuran explícitamente por Worker.)

**Recuperación de cuenta por WhatsApp (ver AGENTS.md §6.7)**: `WHATSAPP_API_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` (WhatsApp Cloud API de Meta) son opcionales en desarrollo — sin ellos, `lib/whatsapp.ts` solo registra en el log que se habría enviado el mensaje (mismo espíritu que Mailpit para el Magic Link, ver AGENTS.md §6.1). Obligatorio darlos de alta antes de producción.

**Login automático en desarrollo (`DEV_AUTO_LOGIN`)** — para probar desde un celular en la misma red LAN sin acceder al Mailpit del escritorio (ver AGENTS.md §6.2): en `.env.local` poner `DEV_AUTO_LOGIN=true` (además de `NODE_ENV` distinto de `production`, ya el caso en `npm run dev`) y asegurarse de que `EMAIL_SERVER_USER`/`EMAIL_SERVER_PASSWORD` coincidan con las credenciales de la API de Mailpit (`admin`/`magiclink123`). Con esto activo, pedir el Magic Link entra directo sin revisar el correo — nunca activar esta variable en producción.

**Probar desde un celular en la misma red** — si el dev server se abre por IP (`http://192.168.x.x:3000`) en vez de `localhost`, agregar esa IP a `allowedDevOrigins` en `next.config.ts` (Next.js no acepta CIDR, solo hosts exactos o comodines de subdominio) para que el HMR no falle.

**`wrangler dev` no escucha en la red local por defecto** (2026-07-25, confirmado real: el celular veía "sin salas" aunque la laptop ya había creado una) — a diferencia de `npm run dev` (Next.js, que sí escucha en todas las interfaces por defecto), `wrangler dev` por defecto solo escucha en `127.0.0.1` (loopback, inaccesible desde otro dispositivo). `npm run party:dev` ya incluye `--ip 0.0.0.0` para evitar este problema — si se corre `wrangler dev` directo sin el script de `package.json`, agregar el flag a mano.

Confirmar con `netstat -an | grep 1999` — debe decir `0.0.0.0:1999 LISTENING`, no `127.0.0.1:1999`. **Si ya estabas conectado desde el celular antes de agregar `--ip 0.0.0.0`** (o antes de cualquier reinicio de `wrangler dev`/edición de `party/*.ts`), esa pestaña tiene una conexión WebSocket vieja contra el servidor anterior que no se reconecta sola — hay que **recargar la página** en ese dispositivo para que abra una conexión nueva contra el servidor actual.

**Troubleshooting (Windows) — "sala vacía" / "0 participantes" / conexión que nunca abre, o `wrangler dev` que no responde a nada**: `workerd.exe` (el runtime que simula Cloudflare Workers localmente, usado tanto por el `partykit dev` original como por `wrangler dev` ahora) tiende a dejar **procesos huérfanos** en Windows cuando el proceso padre de la terminal se mata sin que el hijo reciba la señal — confirmado de nuevo el 2026-07-25 durante la migración a Wrangler: `wrangler dev --port 1999` decía "Ready" y el puerto aparecía `LISTENING` en `netstat`, pero ninguna petición (HTTP ni WebSocket) obtenía respuesta, ni siquiera desde PowerShell nativo — la causa real eran **5 instancias distintas de `workerd.exe` apiladas**, todas peleando por el mismo puerto 1999, de intentos anteriores que nunca se cerraron limpio. Síntoma típico: al crear una sala nueva (aunque nadie más se haya unido todavía) aparece como vacía/llena/rota, o directamente no conecta. **No es un bug de código del proyecto.** Solución — matar TODOS los procesos `workerd.exe` (no solo el más reciente) antes de reintentar:

```powershell
Get-Process -Name workerd -ErrorAction SilentlyContinue | Stop-Process -Force
Get-NetTCPConnection -LocalPort 1999 -ErrorAction SilentlyContinue   # debe salir vacío
# y volver a correr `npx wrangler dev --port 1999` en una terminal limpia
```

Esto reinicia el estado en memoria de la sala; no requiere tocar Mongo ni ningún dato del jugador. Si vuelve a pasar, `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*wrangler*" }` lista todo el árbol de procesos (`bash → node → cmd → wrangler → workerd`) para diagnosticar cuál quedó colgado.

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

npx wrangler deploy --domain game.planet-scape.minegocito.app   # despliega el servidor multijugador (independiente de Vercel)
vercel --prod              # despliega la app Next.js
```

**⚠️ Corrección importante (2026-07-25) sobre lo que decía esta sección antes**: la aclaración original de que `partykit deploy` "no requiere cuenta propia de Cloudflare" **dejó de ser cierta** en cuanto se necesitó un dominio propio — ver el análisis completo en `RETROSPECTIVA.md` y el plan en `docs/PRE-PROD.md` Fase 5. Resumen real:

- **Con el subdominio automático de la plataforma gestionada** (`*.partykit.dev`, lo que hacía el `partykit deploy` original) sí era cierto que no requería cuenta propia de Cloudflare — pero esa plataforma quedó **descontinuada/saturada** (límite de 10,000 dominios en su zona compartida, y el CLI viejo no soporta el requisito nuevo de Cloudflare de migraciones `new_sqlite_classes`).
- **Con `wrangler deploy --domain <tu-dominio>`** (la ruta que el proyecto usa ahora) **sí se requiere una cuenta propia de Cloudflare** con un dominio ya agregado ahí, más un **API Token** con permisos específicos (`Account: Workers Scripts (Edit)`, `Account: Workers KV Storage (Edit)`, `Zone: DNS (Edit)`, `Zone: Workers Routes (Edit)`, acotado a la zona/cuenta específica) y el **Account ID** — ambos van como `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` en el entorno donde se corra `wrangler deploy` (nunca versionados).
- No hace falta un VPS en ningún caso — Cloudflare sigue gestionando el hosting/autoescalado del Worker igual que antes, solo cambia quién es el "dueño" del dominio (antes PartyKit, ahora tú).

---

## Notas

- Comandos ya implementados en `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `typecheck:party`, `seed:*`, `party:dev` (`wrangler dev`), `party:deploy` (`wrangler deploy`). Los de test (`test`, `test:e2e`, `test:api`, `test:load`) se agregan en su fase correspondiente (9).
- El paquete `partykit` (CLI de la plataforma gestionada) fue **desinstalado** (2026-07-25) — reemplazado por `partyserver` + `wrangler`, ver más arriba. `partykit.json` fue borrado y reemplazado por `wrangler.jsonc`.
- Los contenedores de `docker-compose.yml` pueden ya estar corriendo de forma compartida con otro proyecto local en esta máquina (mismos puertos/credenciales) — ver incidente registrado en [`RETROSPECTIVA.md`](./RETROSPECTIVA.md). `docker compose up -d` fallará con "port is already allocated" si es el caso; no es un error bloqueante, solo confirma que el Mongo/Mailpit compartido ya está disponible.
- Cualquier cambio a esta estructura o a estos comandos debe reflejarse aquí **y** en `AGENTS.md` (registrar en el Changelog, §16), según la regla de sincronización.
