# DEPLOYMENT.md — Planet Scape of the Solar System

> Pasos de despliegue a producción.
> Sincronizado con [`AGENTS.md`](./AGENTS.md) — ver regla de sincronización en [AGENTS.md §0.1](./AGENTS.md#01-regla-de-sincronizacion-de-documentacion).

---

## 1. Resumen de Componentes a Desplegar

| Componente | Destino | Gestionado por |
|---|---|---|
| App Next.js (landing, auth, HUD, admin, API Routes) | **Vercel** | Vercel (autoescalable, TLS automático) — ⏳ pendiente, ver `docs/PRE-PROD.md` Fase 7 |
| Servidor multijugador | **Cloudflare Workers** (`partyserver`/Wrangler, migrado de PartyKit el 2026-07-25) | Cloudflare — ✅ desplegado y validado en producción (`game.planet-scape.minegocito.app`, 2026-07-26), ver `docs/PRE-PROD.md` Fase 5. `APP_ORIGIN` sigue en valor de desarrollo hasta la Fase 7 |
| Base de datos | **MongoDB Atlas** (cluster M0 gratis) | Atlas — ✅ creado y sembrado (2026-07-25), ver `docs/PRE-PROD.md` Fase 2 |
| Email transaccional | **Resend** + dominio propio `planet-scape.minegocito.app` | Resend — ✅ verificado y probado con un correo real (2026-07-25), ver `docs/PRE-PROD.md` Fase 3 |
| Pagos | Stripe (modo live) | Stripe — 🔄 cuenta activada y claves validadas (2026-07-25), webhook pendiente del dominio de Vercel, ver `docs/PRE-PROD.md` Fase 4 |

> Este documento (`DEPLOYMENT.md`) sigue siendo la referencia general de checklist/pasos; el **detalle operativo real ejecutado** (capturas, valores exactos, incidentes encontrados) vive en [`docs/PRE-PROD.md`](./docs/PRE-PROD.md), que se actualiza fase por fase a medida que se ejecuta el despliegue real.

---

## 2. Checklist Previo al Primer Despliegue

- [x] **Sustituir Mailpit por un proveedor de email real** — ✅ hecho 2026-07-25, Resend + `planet-scape.minegocito.app`, ver [AGENTS.md §6.1](./AGENTS.md#61-advertencia-critica-mailpit-en-produccion) y `docs/PRE-PROD.md` Fase 3.
- [x] Migrar `MONGODB_URI` de Docker local a MongoDB Atlas — ✅ hecho 2026-07-25 (cluster M0, `seed-schema` + `seed-config` + `seed-admins` corridos contra Atlas), ver `docs/PRE-PROD.md` Fase 2.
- [x] Configurar claves de Stripe en modo **live** (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) — ✅ hecho 2026-07-25, validadas contra la API real de Stripe.
- [ ] Registrar el endpoint del webhook de Stripe (`/api/webhooks/stripe`) en el dashboard de Stripe apuntando al dominio de producción — el `STRIPE_WEBHOOK_SECRET` de producción es distinto al usado en local con `stripe listen`. **Bloqueado hasta que exista el dominio real de Vercel** (Fase 7) — Stripe no permite registrar un webhook contra una URL que todavía no responde. Pasos exactos (dev y prod) en [`QUICK-START.md` — sección Stripe](./QUICK-START.md#stripe-fase-7--implementado-y-probado-con-un-pago-real-de-principio-a-fin).
- [ ] Confirmar que todas las variables de [`INFRA.md` §3](./INFRA.md#3-variables-de-entorno) están cargadas en Vercel Project Settings (no solo en `.env.local`) — incluye las nuevas de Resend/Stripe live/Cloudflare, ver `docs/PRE-PROD.md` Fase 7.
- [x] `npx wrangler deploy --domain game.planet-scape.minegocito.app` — ✅ hecho 2026-07-26 (migrado de `npx partykit deploy`, ver §3.2 abajo). Falta solo asegurar que `NEXT_PUBLIC_PARTYKIT_HOST=game.planet-scape.minegocito.app` quede configurado en Vercel en la Fase 7.
- [ ] Ejecutar la suite completa de pruebas ([AGENTS.md §11](./AGENTS.md#11-testing-y-qa)) contra el entorno de staging antes del switch a producción.
- [ ] Re-ejecutar `npm audit` — a la fecha (2026-07-21) hay 3 vulnerabilidades transitivas conocidas de `next`/`@auth/mongodb-adapter` sin fix propio disponible, ver detalle y por qué no bloquean en [`RETROSPECTIVA.md`](./RETROSPECTIVA.md). Confirmar que ya haya parche antes de ir a producción; si no, revalidar que el riesgo residual siga siendo aceptable. **Nota 2026-07-25**: la migración a `wrangler`/`partyserver` agregó dependencias nuevas — re-ejecutar `npm audit` también cubre estas.

---

## 3. Pasos de Despliegue

### 3.1 Base de datos (una sola vez) ✅ hecho (2026-07-25)

1. Crear cluster MongoDB Atlas M0.
2. Crear usuario de base de datos con permisos de lectura/escritura sobre `planet_scape`.
3. Añadir la IP de salida de Vercel (o `0.0.0.0/0` con autenticación fuerte, dado que Vercel usa IPs dinámicas) a la whitelist de Atlas.
4. Ejecutar seeds de esquema, configuración y admins (`npm run seed:schema && npm run seed:config && npm run seed:admins` — equivalente a `npm run seed`, con `MONGODB_URI` apuntando a Atlas).

Detalle real ejecutado (credenciales, decisiones tomadas) en [`docs/PRE-PROD.md` Fase 2](./docs/PRE-PROD.md#fase-2--mongodb-atlas-base-de-datos-de-produccion--hecho-2026-07-25).

### 3.2 Servidor multijugador ✅ desplegado en producción (2026-07-26)

> **⚠️ Sección corregida (2026-07-25)** — lo que decía aquí sobre PartyKit **dejó de ser cierto** y causó confusión real: ver el incidente completo en [`RETROSPECTIVA.md`](./RETROSPECTIVA.md) y el análisis en [`docs/PRE-PROD.md` Fase 5](./docs/PRE-PROD.md#fase-5--partykit-deploy-a-produccion-hecho-2026-07-26--migrado-a-partyserverwrangler-desplegado-y-validado-en-produccion-real). Resumen: la plataforma gestionada de PartyKit (`npx partykit deploy`) quedó bloqueada por un límite de su zona compartida de dominios Y porque su CLI (sin actualizar desde antes de que Cloudflare comprara PartyKit en 2024) no soporta el requisito nuevo de Cloudflare de migraciones `new_sqlite_classes` para Durable Objects en el plan gratuito. El proyecto migró a **Wrangler** (CLI oficial de Cloudflare) + **`partyserver`** (mismo equipo, misma forma de API) — ver `party/worker.ts`, `wrangler.jsonc`.

**Esto SÍ requiere una cuenta propia de Cloudflare** con el dominio ya agregado ahí (a diferencia de lo que decía la versión anterior de este documento), más credenciales de API:

1. Generar un **API Token** de Cloudflare (`dash.cloudflare.com/profile/api-tokens` → Create Custom Token) con estos permisos, acotados a la cuenta/zona específica del proyecto (nunca "All accounts"/"All zones"):
   - `Account` → `Workers Scripts` → `Edit`
   - `Account` → `Workers KV Storage` → `Edit`
   - `Zone` → `DNS` → `Edit`
   - `Zone` → `Workers Routes` → `Edit`
2. Obtener el **Account ID** (visible en el dashboard de Cloudflare, sección Overview del dominio).
3. **Requisito de una sola vez por cuenta**: si es la primera vez que esta cuenta de Cloudflare despliega cualquier Worker, hay que entrar al dashboard → "Workers & Pages" antes del primer deploy — Cloudflare exige que la cuenta tenga un subdominio `*.workers.dev` asignado (no es específico de este proyecto; lo asigna automáticamente al entrar, sin pedir que se elija un nombre). Sin este paso, `wrangler deploy` falla con `Error 10063`.
4. Exportar el Account ID y el token como variables de entorno donde se corra el deploy (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` — nunca versionados):

   ```bash
   npx wrangler deploy --domain game.planet-scape.minegocito.app
   ```

5. El comando agrega automáticamente el registro DNS necesario en la zona de Cloudflare y despliega el Worker con TLS automático — no requiere un VPS ni configuración manual de Cloudflare Workers más allá del token/dominio.
6. Subir los secrets del Worker (no se leen de ningún `.env` local en producción, a diferencia de `wrangler dev`):

   ```bash
   npx wrangler secret put PARTYKIT_SHARED_SECRET   # valor DISTINTO al de desarrollo
   npx wrangler secret put APP_ORIGIN                # URL real de Vercel — pendiente hasta la Fase 7
   ```

7. Usar ese dominio (`game.planet-scape.minegocito.app`) como `NEXT_PUBLIC_PARTYKIT_HOST` en las variables de entorno de Vercel.

**Validado real, en dos etapas**:

- **Local** (2026-07-25) con `npx wrangler dev --port 1999 --ip 0.0.0.0`: conexión WebSocket real a `GameRoom` y `Directory`, RPC directo entre ambos Durable Objects, y prueba con dispositivos reales (laptop + celular en la misma LAN) — el flag `--ip 0.0.0.0` es necesario porque `wrangler dev` no escucha en la red local por defecto (a diferencia de `next dev`).
- **Producción real** (2026-07-26): tras el deploy, validado con tres verificaciones independientes contra `https://game.planet-scape.minegocito.app` (no local) — `curl` a la raíz (`404` esperado), `nslookup` confirmando IPs reales de Cloudflare, y una conexión **WebSocket real** contra `wss://game.planet-scape.minegocito.app/parties/main/{roomId}` que abrió correctamente y recibió el mensaje `roster` esperado del `GameRoom` desplegado. Detalle completo en [`docs/PRE-PROD.md` Fase 5](./docs/PRE-PROD.md).

### 3.3 App Next.js

```bash
npm run build   # validación local previa — solo al cerrar una fase (AGENTS.md §12, regla 9)
vercel --prod
```

Vercel gestiona automáticamente el certificado TLS del dominio (no se requiere `CERTIFICADOS.md` — decisión documentada en [AGENTS.md §0](./AGENTS.md#0-decisiones-de-gobernanza-confirmadas-con-el-usuario-2026-07-21)).

### 3.4 Verificación post-despliegue

1. `GET /api/health` responde `{ status: "ok" }`.
2. Flujo de Magic Link end-to-end con un email real (no Mailpit).
3. Crear una partida de prueba con 2 dispositivos distintos y confirmar sincronización.
4. Donación de prueba en modo Stripe live con monto mínimo, confirmar acreditación de 200 estrellas.

---

## 4. Rollback

- **App Next.js**: Vercel mantiene despliegues inmutables — usar "Promote to Production" sobre el despliegue anterior estable desde el dashboard de Vercel.
- **Servidor multijugador**: `npx wrangler deploy --domain game.planet-scape.minegocito.app` de la versión anterior del código (control de versiones vía git tags recomendado antes de cada despliegue).
- **Base de datos**: los cambios de esquema deben ser aditivos y retrocompatibles (nunca eliminar campos en el mismo despliegue que deja de usarlos) para permitir rollback de la app sin migración inversa de datos.
