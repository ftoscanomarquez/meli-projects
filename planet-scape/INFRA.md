# INFRA.md — Planet Scape of the Solar System

> Arquitectura física y lógica: requerimientos mínimos, mapeo de resiliencia, variables de entorno y `docker-compose.yml`.
> Sincronizado con [`AGENTS.md`](./AGENTS.md) — ver regla de sincronización en [AGENTS.md §0.1](./AGENTS.md#01-regla-de-sincronizacion-de-documentacion).

---

## 1. Requerimientos Mínimos de Hardware y Software

### 1.1 Navegadores validados (cliente)

Chrome 120+, Firefox 118+, Edge 120+. WebGL 2 requerido (para PixiJS) — se debe mostrar un mensaje de compatibilidad amable si el navegador no lo soporta, en vez de fallar en silencio.

### 1.2 Producción

La app Next.js se despliega en **Vercel** (serverless, autoescalable) y el servidor multijugador directamente en **Cloudflare Workers** (Durable Objects vía `partyserver`/Wrangler — migrado de la plataforma gestionada PartyKit el 2026-07-25, ver `RETROSPECTIVA.md` y `docs/PRE-PROD.md` Fase 5) — **no hay servidor dedicado que dimensionar**: ambos proveedores gestionan el escalado horizontal automáticamente. La base de datos recomendada para producción es MongoDB Atlas (cluster M0, ya creado — ver `docs/PRE-PROD.md` Fase 2).

#### 1.2.1 Subdominios de producción (dominio propio `minegocito.app`, Cloudflare)

Todo el proyecto vive bajo el mismo dominio raíz del usuario, agrupado por subdominio según a qué servicio apunta cada uno:

| Subdominio | Apunta a | Para qué | Estado |
|---|---|---|---|
| `planet-scape.minegocito.app` | Vercel (registro `CNAME` → `cname.vercel-dns.com`) | La app completa: landing, auth, motor de juego, panel admin, todas las rutas `/api/*` | ⏳ pendiente — ver `docs/PRE-PROD.md` Fase 7 |
| `game.planet-scape.minegocito.app` | Cloudflare Workers (`wrangler deploy --domain`) | Servidor multijugador — WebSocket de salas (`GameRoom`) y directorio de salas abiertas (`Directory`) | ✅ desplegado y validado (2026-07-26) |
| `send.planet-scape.minegocito.app` | Resend (registros MX/TXT vía "Auto configure") | Envío de correo transaccional (Magic Link) | ✅ verificado (2026-07-25) |

Para los dos subdominios ya activos (`game.*`/`send.*`), el registro DNS correspondiente en Cloudflare se creó **automáticamente** por la herramienta respectiva (Wrangler y el "Auto configure" de Resend) — no requirió edición manual del panel de DNS. El de Vercel (`planet-scape.*`, sin el subdominio `game`) sí se agrega manualmente desde el dashboard de Vercel cuando se ejecute la Fase 7, siguiendo el mismo patrón: Vercel indica el valor del `CNAME`, se agrega en Cloudflare con **Proxy status: DNS only** (mismo criterio que los otros dos, para no interferir con el TLS que cada plataforma gestiona por su cuenta).

### 1.3 Entorno de Desarrollo Local (equipo del desarrollador)

Para correr simultáneamente Next.js dev server + PartyKit dev + Docker (MongoDB + Mailpit):

| Recurso | Mínimo recomendado |
|---|---|
| Sistema Operativo | Windows 10/11, macOS 13+, o Linux (Ubuntu 22.04 LTS+) con Docker/Docker Desktop |
| CPU | 4 núcleos |
| RAM | 8 GB (16 GB recomendado si se corre además un IDE pesado) |
| Almacenamiento | 5 GB libres (imágenes Docker + `node_modules`) |
| Node.js | 20 LTS+ |
| Docker | Docker Desktop / Docker Engine 24+ |

### 1.4 Capacidad esperada (objetivo de carga)

| Escenario | Objetivo |
|---|---|
| Usuarios concurrentes en un instante dado sin degradar | **100 conexiones WebSocket simultáneas** (25 salas de 4 jugadores) |
| Sostenido en una ventana de 15 minutos sin degradación | Las mismas 100 conexiones, sostenidas 15 min, sin pérdida de sincronización de física ni desconexiones |

Este número se fija como punto de partida realista para un juego familiar (no enterprise) — ver justificación y herramientas de prueba (k6) en [AGENTS.md §11](./AGENTS.md#11-testing-y-qa). Debe revisarse al alza si el juego gana tracción, dado que tanto Vercel como PartyKit escalan horizontalmente sin cambios de arquitectura.

---

## 2. Mapeo de Resiliencia (adaptado — sin Traefik)

Como no se usa Traefik (excluido, ver [AGENTS.md §0](./AGENTS.md#0-decisiones-de-gobernanza-confirmadas-con-el-usuario-2026-07-21)), los patrones de resiliencia se implementan en la **capa de aplicación** (Next.js API Routes):

| Patrón | Capa | Detalle |
|---|---|---|
| **Rate Limiting** | Código — Next.js API Routes | Limitador basado en Upstash Redis (serverless-friendly, compatible con Vercel Edge) aplicado a `/api/auth/signin`, `/api/donations/checkout` y `/api/admin/*`. Fallback en memoria por instancia si Upstash no está configurado (documentado como no apto para escalado horizontal). |
| **Circuit Breaker** | Código — Next.js API Routes | Librería `cockatiel` envolviendo llamadas a Stripe y al servicio de email. Ante fallos consecutivos el circuito se abre y deriva a un fallback controlado (toast de error en UI) en vez de colgar el request. |
| **Rastreo de estado** | Pino → Vercel Logs | Cada apertura/cierre de circuito se loggea con `event: "circuit_open"` / `"circuit_closed"` para poder auditarse. Ver [`OBSERVABILIDAD.md`](./OBSERVABILIDAD.md). |

No se usa `middleware.tsx` de Next.js para estas validaciones (regla de la skill `toscaprompt`); se implementan como funciones utilitarias (`lib/resilience/`) invocadas explícitamente al inicio de cada Route Handler.

---

## 3. Variables de Entorno

```env
# Base de datos
MONGODB_URI=mongodb://admin:magiclink123@localhost:27019/?authSource=admin
MONGODB_DB=planet_scape

# Auth.js / Magic Link
AUTH_SECRET=<generar con: openssl rand -base64 32>
EMAIL_SERVER_HOST=localhost
EMAIL_SERVER_PORT=1025
EMAIL_SERVER_USER=admin
EMAIL_SERVER_PASSWORD=magiclink123
EMAIL_FROM=noreply@planetscape.local

# Mailpit (solo referencia UI local)
MAILPIT_UI_URL=http://localhost:8025

# i18n
NEXT_PUBLIC_DEFAULT_LOCALE=es
NEXT_PUBLIC_LOCALES=es,en

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<clave_publica_stripe>
STRIPE_SECRET_KEY=<clave_secreta_stripe>
STRIPE_WEBHOOK_SECRET=<clave_webhook_stripe>

# PartyKit
NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999

# Rate limiting (opcional — fallback en memoria si se omite)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Logging
PINO_LOG_LEVEL=info
```

Un `.env.example` idéntico (sin valores secretos reales) debe versionarse en la raíz del repositorio.

---

## 4. `docker-compose.yml` de Referencia (solo lo necesario)

```yaml
services:
  mongodb:
    image: mongo:7
    container_name: planet-scape-mongo
    restart: unless-stopped
    ports:
      - "27019:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: magiclink123
    volumes:
      - mongo_data:/data/db

  mailpit:
    image: axllent/mailpit
    container_name: planet-scape-mailpit
    restart: unless-stopped
    ports:
      - "8025:8025"   # UI
      - "1025:1025"   # SMTP
    environment:
      MP_SMTP_AUTH: "admin:magiclink123"

volumes:
  mongo_data:
```

**Nota de agnosticismo (regla de la skill):** aunque el resto de la infraestructura (Traefik, Vault, Elasticsearch/Kibana, SonarQube) está excluida por decisión de proyecto ([AGENTS.md §0](./AGENTS.md#0-decisiones-de-gobernanza-confirmadas-con-el-usuario-2026-07-21)), este `docker-compose.yml` cubre íntegramente lo que el proyecto sí necesita para correr en local: Mongo + Mailpit.
