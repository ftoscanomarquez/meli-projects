# DEPLOYMENT.md — Planet Scape of the Solar System

> Pasos de despliegue a producción.
> Sincronizado con [`AGENTS.md`](./AGENTS.md) — ver regla de sincronización en [AGENTS.md §0.1](./AGENTS.md#01-regla-de-sincronizacion-de-documentacion).

---

## 1. Resumen de Componentes a Desplegar

| Componente | Destino | Gestionado por |
|---|---|---|
| App Next.js (landing, auth, HUD, admin, API Routes) | **Vercel** | Vercel (autoescalable, TLS automático) |
| Servidor multijugador | **PartyKit** | Cloudflare (vía PartyKit, autoescalable) |
| Base de datos | **MongoDB Atlas** (M0 free tier para lanzamiento) | Atlas |
| Email transaccional | Proveedor real (Resend/SES/SendGrid — reemplaza a Mailpit) | Proveedor elegido |
| Pagos | Stripe (modo live) | Stripe |

---

## 2. Checklist Previo al Primer Despliegue

- [ ] **Sustituir Mailpit por un proveedor de email real** — bloqueante crítico, ver [AGENTS.md §6.1](./AGENTS.md#61-advertencia-critica-mailpit-en-produccion). Sin esto, el Magic Link no llega a usuarios reales.
- [ ] Migrar `MONGODB_URI` de Docker local a MongoDB Atlas (mismo nombre de base de datos, correr `scripts/seeds/seed-schema.ts` y `seed-config.ts` contra Atlas).
- [ ] Configurar claves de Stripe en modo **live** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) — nunca reutilizar las de test.
- [ ] Registrar el endpoint del webhook de Stripe (`/api/webhooks/stripe`) en el dashboard de Stripe apuntando al dominio de producción — el `STRIPE_WEBHOOK_SECRET` de producción es distinto al usado en local con `stripe listen`. Pasos exactos (dev y prod) en [`QUICK-START.md` — sección Stripe](./QUICK-START.md#stripe-fase-7--implementado-y-probado-con-un-pago-real-de-principio-a-fin).
- [ ] Confirmar que todas las variables de [`INFRA.md` §3](./INFRA.md#3-variables-de-entorno) están cargadas en Vercel Project Settings (no solo en `.env.local`).
- [ ] `npx partykit deploy` — validar que el dominio de PartyKit en producción coincide con `NEXT_PUBLIC_PARTYKIT_HOST` configurado en Vercel.
- [ ] Ejecutar la suite completa de pruebas ([AGENTS.md §11](./AGENTS.md#11-testing-y-qa)) contra el entorno de staging antes del switch a producción.
- [ ] Re-ejecutar `npm audit` — a la fecha (2026-07-21) hay 3 vulnerabilidades transitivas conocidas de `next`/`@auth/mongodb-adapter` sin fix propio disponible, ver detalle y por qué no bloquean en [`RETROSPECTIVA.md`](./RETROSPECTIVA.md). Confirmar que ya haya parche antes de ir a producción; si no, revalidar que el riesgo residual siga siendo aceptable.

---

## 3. Pasos de Despliegue

### 3.1 Base de datos (una sola vez)

1. Crear cluster MongoDB Atlas M0.
2. Crear usuario de base de datos con permisos de lectura/escritura sobre `planet_scape`.
3. Añadir la IP de salida de Vercel (o `0.0.0.0/0` con autenticación fuerte, dado que Vercel usa IPs dinámicas) a la whitelist de Atlas.
4. Ejecutar seeds de esquema y configuración (`npm run seed:schema && npm run seed:config` con `MONGODB_URI` apuntando a Atlas).

### 3.2 Servidor multijugador

> **Aclaración importante** (2026-07-23, duda real del usuario): desplegar esto **no requiere una cuenta propia de Cloudflare, ni un VPS, ni configurar Cloudflare Workers a mano**. PartyKit es un servicio ya hospedado (igual que Vercel/Stripe/Atlas) — por debajo corre sobre la infraestructura de Cloudflare, pero es la cuenta de Cloudflare de PartyKit, no la del proyecto. Solo hace falta una cuenta gratuita de PartyKit (`npx partykit login`, vía GitHub) antes del primer `deploy`.

```bash
npx partykit login     # una sola vez, cuenta gratuita vía GitHub
npx partykit deploy
```

El comando devuelve automáticamente una URL HTTPS lista para usar (tipo `planet-scape.<usuario>.partykit.dev`, sin configurar DNS ni certificados). Anotar esa URL y usarla como `NEXT_PUBLIC_PARTYKIT_HOST` en las variables de entorno de Vercel.

**Dominio propio (opcional, no bloqueante)**: el dominio del proyecto en Cloudflare (`minegocito.app`, ya con wildcard) se puede mapear más adelante a este despliegue (ej. `game.minegocito.app`) desde el dashboard de PartyKit, agregando un registro DNS — pero la URL `*.partykit.dev` por defecto ya es suficiente para producción real; esto es puramente estético.

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
- **PartyKit**: `npx partykit deploy` de la versión anterior del código (control de versiones vía git tags recomendado antes de cada despliegue).
- **Base de datos**: los cambios de esquema deben ser aditivos y retrocompatibles (nunca eliminar campos en el mismo despliegue que deja de usarlos) para permitir rollback de la app sin migración inversa de datos.
