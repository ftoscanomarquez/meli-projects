# OBSERVABILIDAD.md — Planet Scape of the Solar System

> Configuración de trazas, logs y métricas de salud del sistema.
> Sincronizado con [`AGENTS.md`](./AGENTS.md) — ver regla de sincronización en [AGENTS.md §0.1](./AGENTS.md#01-regla-de-sincronizacion-de-documentacion).

---

## 1. Decisión de Stack

**Elasticsearch/Kibana quedan excluidos** de este proyecto (ver [AGENTS.md §0](./AGENTS.md#0-decisiones-de-gobernanza-confirmadas-con-el-usuario-2026-07-21) — "Regla de Exclusión de Tecnologías"): para el volumen de tráfico esperado de un juego familiar, añadir un stack de indexación de logs sería sobre-ingeniería. En su lugar:

- **Logging estructurado**: [Pino](https://getpino.io/), formato JSON.
- **Recolección en producción**: Vercel Logs (nativo, sin configuración adicional) para la app Next.js; PartyKit expone sus propios logs de despliegue vía `npx partykit tail`.
- **Recolección en desarrollo local**: además de stdout, se escribe a un archivo físico `logs/app.log` (requisito explícito de la skill `toscaprompt`: "siempre deje un archivo Log físico que se pueda analizar").

Si el proyecto escala y se justifica más adelante, este documento es el punto de re-entrada para incorporar Elasticsearch/Kibana sin tener que rediseñar el logging (Pino ya emite JSON estructurado, compatible con cualquier pipeline de ingesta).

---

## 2. Formato de Log

Cada entrada de Pino incluye como mínimo:

```json
{
  "level": "info",
  "time": 1753000000000,
  "msg": "donation.checkout.created",
  "requestId": "req_9f2a...",
  "playerId": "665f1...",
  "route": "/api/donations/checkout"
}
```

- `requestId`: generado por request (UUID), permite correlacionar todos los logs de un mismo flujo (ej. creación de checkout → webhook → acreditación de estrellas).
- `playerId`: presente siempre que la request esté autenticada.
- Eventos de resiliencia (ver [`INFRA.md` §2](./INFRA.md#2-mapeo-de-resiliencia-adaptado--sin-traefik)) usan el campo `event`: `circuit_open`, `circuit_closed`, `rate_limit_exceeded`.

---

## 3. Dónde se instrumenta

| Componente | Instrumentación |
|---|---|
| Next.js API Routes | Pino en cada Route Handler (`lib/logger.ts`), un log de entrada y uno de salida/error por request |
| Servidor PartyKit | Pino equivalente por evento de sala: `room.created`, `room.player_joined`, `room.game_started`, `room.game_ended` |
| Webhooks de Stripe | Log obligatorio de verificación de firma (éxito/fallo) — crítico para auditoría de pagos |
| Auth.js | Log de intento de login (sin loggear el token del magic link, solo el email y el resultado) |

---

## 4. Health Check

`GET /api/health` — verifica:
1. Conectividad a MongoDB (ping).
2. Conectividad a Mailpit en desarrollo (`MAILPIT_UI_URL` alcanzable) — en producción esta verificación se omite (el proveedor de email real expone su propio status page).

Respuesta: `{ status: "ok" | "degraded", checks: { mongo: boolean, mail: boolean } }`.

---

## 5. Métricas de Negocio a Vigilar (informativo, sin dashboard dedicado por ahora)

- Partidas jugadas por día.
- Donaciones acumuladas (monto y conteo).
- Nuevos perfiles creados por día.

Sugerido como mejora futura en [`MEJORAS.md`](./MEJORAS.md) (vista de analítica simple en el panel admin) en vez de introducir Kibana solo para esto.
