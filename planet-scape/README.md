# Planet Scape of the Solar System 🪐

Juego web infantil, multijugador en tiempo real (1-4 jugadores), con estética inspirada en la serie *SolarBalls*. Selecciona un planeta, esquiva asteroides y llamaradas solares, recolecta estrellas y pulsares, y sobrevive derrotando al Agujero Negro para subir de nivel.

> Proyecto en **Fase 0 (Fundación / Especificación)** — código aún no iniciado. Ver estado de fases en [`AGENTS.md` §2](./AGENTS.md#2-plan-de-fases-planificacion-estricta).

---

## Documentación del Proyecto

Este proyecto sigue la skill de gobernanza `toscaprompt`. Todos los documentos abajo se mantienen sincronizados entre sí (ver [`AGENTS.md` §0.1](./AGENTS.md#01-regla-de-sincronizacion-de-documentacion)):

| Documento | Contenido |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | **Fuente de verdad.** Gobernanza, fases estrictas, mecánicas del juego, reglas de código y diseño, decisiones de infraestructura, changelog. |
| [`QUICK-START.md`](./QUICK-START.md) | Estructura del proyecto y comandos CLI (dev, build, tests, seeds, deploy). |
| [`SPECIFICATION-SUMMARY.md`](./SPECIFICATION-SUMMARY.md) | Tabla de tecnologías justificadas, esquemas Zod, contratos de API, diagrama Mermaid general. |
| [`DIAGRAMAS.md`](./DIAGRAMAS.md) | Diagrama de clases, máquinas de estado, diagramas de secuencia, modelo de persistencia (ER). |
| [`INFRA.md`](./INFRA.md) | Requerimientos de hardware/software, capacidad de carga objetivo, mapeo de resiliencia, variables de entorno, `docker-compose.yml`. |
| [`OBSERVABILIDAD.md`](./OBSERVABILIDAD.md) | Logging estructurado (Pino), health check, correlación de requests. |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Checklist y pasos de despliegue a producción (Vercel + PartyKit + Atlas). |
| [`MEJORAS.md`](./MEJORAS.md) | Sugerencias de mejora sobre el diseño original (propuestas, no compromisos). |
| [`RETROSPECTIVA.md`](./RETROSPECTIVA.md) | Bitácora de problemas de implementación y sus soluciones. |
| [`PROMPT.md`](./PROMPT.md) | Brief funcional original del usuario (insumo, no se edita). |

`CERTIFICADOS.md` no se genera para este proyecto: el despliegue es sobre Vercel, que gestiona TLS de forma nativa (Traefik está excluido, ver [`AGENTS.md` §0](./AGENTS.md#0-decisiones-de-gobernanza-confirmadas-con-el-usuario-2026-07-21)).

---

## Setup Rápido (Desarrollo Local)

```bash
# 1. Infraestructura local (MongoDB + Mailpit)
docker compose up -d

# 2. Dependencias
npm install

# 3. Variables de entorno
cp .env.example .env.local   # completar con las credenciales de abajo

# 4. Semillas de base de datos
npm run seed

# 5. Levantar la app y el servidor multijugador
npm run dev
npx partykit dev
```

Detalle completo de comandos en [`QUICK-START.md`](./QUICK-START.md).

---

## Credenciales por Defecto (infraestructura local)

| Servicio | URL | Usuario | Contraseña |
|---|---|---|---|
| MongoDB | `mongodb://localhost:27019/?authSource=admin` | `admin` | `magiclink123` |
| Mailpit (UI de correos) | http://localhost:8025 | `admin` | `magiclink123` |

### Convertir un jugador en administrador (local)

No existe registro de admin por UI (por seguridad). Tras iniciar sesión una vez por Magic Link con tu email, promuévelo manualmente:

```bash
npm run seed:admin -- --email=tu-email@ejemplo.com
```

Esto actualiza `players.role` a `"admin"` para ese perfil, dándole acceso a `/admin` (ver [`AGENTS.md` §9](./AGENTS.md#9-panel-de-administracion)).

---

## Roles

- **Jugador**: rol por defecto. Selecciona planeta, juega partidas, acumula estrellas, dona voluntariamente.
- **Administrador**: ajusta balance del juego (duraciones de habilidades, frecuencias de spawn, configuración del Agujero Negro, enlaces de WhatsApp) y puede buscar jugadores para ajustar sus estrellas manualmente. Ver [`AGENTS.md` §9](./AGENTS.md#9-panel-de-administracion).

---

## Créditos

Un proyecto de **Meli** y **Francisco (Papá)** — parte de la aportación voluntaria del juego apoya que Meli siga estudiando y creando; Francisco ofrece enseñar a otros papás/mamás a crear con IA. Ver el mensaje completo de agradecimiento en [`AGENTS.md` §10](./AGENTS.md#10-pagos-stripe--aportacion-voluntaria).
