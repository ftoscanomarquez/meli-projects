import { Server, getServerByName, type Connection, type ConnectionContext } from "partyserver";
import type { ClientMessage, ServerMessage, RosterPlayer, DirectoryUpdate } from "./messages";
import type { PlanetKey } from "../engine/characterSvg";
import type Directory from "./directory";
import type { Env } from "./worker";

/**
 * Sala de partida — ver AGENTS.md §8. Solo gestiona lobby/roster y relevo
 * de posiciones entre jugadores; NO simula asteroides/Sol/agujero negro
 * (eso corre determinista en cada cliente a partir de `seed`, ver
 * engine/rng.ts) — evita tener que portar el motor de PixiJS a un entorno
 * sin canvas, y el servidor de la sala se mantiene simple.
 *
 * Migrado de "partykit" (plataforma gestionada, CLI congelado en v0.0.115,
 * sin soporte para el requisito nuevo de Cloudflare de migraciones
 * `new_sqlite_classes`) a "partyserver" (mismo equipo de Cloudflare, corre
 * directo sobre Wrangler/Durable Objects nativos) — ver docs/PRE-PROD.md
 * Fase 5. La forma de la clase es casi idéntica; los cambios reales:
 * `extends Server<Env>` en vez de `implements Party.Server`, `this.name` en
 * vez de `this.room.id`, `this.broadcast`/`this.getConnections()` en vez de
 * `this.room.broadcast`/`this.room.getConnections()`, `onMessage(connection,
 * message)` en vez de `onMessage(message, sender)`, y `getServerByName()`
 * en vez de `room.context.parties.directory.get(id).fetch()`.
 */

const MAX_PLAYERS = 4;
const LOBBY_DURATION_MS = 180_000;
// Los 7 planetas jugables (4 iniciales + Júpiter/Saturno/Neptuno,
// desbloqueables con estrellas — ver AGENTS.md §5/§9). El servidor de sala
// no valida la compra en sí (eso ya lo hizo /api/planets/unlock antes de
// llegar aquí); solo evita que un valor arbitrario rompa el roster.
const PLAYABLE_PLANETS: PlanetKey[] = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "neptune"];

function send(connection: Connection, message: ServerMessage) {
  connection.send(JSON.stringify(message));
}

export default class GameRoom extends Server<Env> {
  players = new Map<string, RosterPlayer>();
  status: "lobby" | "playing" = "lobby";
  lobbyEndsAt = 0;
  private lobbyTimer?: ReturnType<typeof setTimeout>;
  // El jugador que creó la sala (el primero en conectarse) — ver AGENTS.md
  // §8.2, pedido explícito del usuario (2026-07-23): resaltar su alias en
  // el Top 5 de equipos. Nunca se reasigna aunque el líder se desconecte
  // (atribución histórica de quién creó la sala, no "quién manda ahora").
  private leaderPlayerId: string | null = null;

  private broadcastMsg(message: ServerMessage, exclude: string[] = []) {
    this.broadcast(JSON.stringify(message), exclude);
  }

  onConnect(connection: Connection, ctx: ConnectionContext) {
    if (this.status === "playing") {
      send(connection, { type: "roomFull" });
      connection.close(4000, "game_in_progress");
      return;
    }
    if (this.players.size >= MAX_PLAYERS) {
      send(connection, { type: "roomFull" });
      connection.close(4000, "room_full");
      return;
    }

    const url = new URL(ctx.request.url);
    const displayName = (url.searchParams.get("name") ?? "Jugador").slice(0, 30);
    const planetParam = url.searchParams.get("planet") ?? "mercury";
    const planet = PLAYABLE_PLANETS.includes(planetParam as PlanetKey) ? (planetParam as PlanetKey) : "mercury";
    // Chat en vivo (ver AGENTS.md §6.5) — `isAdult` viene del cliente (mismo
    // nivel de confianza que `name`/`planet`, que ya son client-authoritative
    // en este proyecto — ver AGENTS.md §8), pero ese booleano en sí ya fue
    // calculado server-side por Next.js a partir de la fecha de nacimiento
    // real (ver lib/auth.ts session callback) y nunca se expuso la fecha en
    // sí — no es que el cliente pueda "declararse adulto" sin que un
    // servidor ya lo haya verificado antes.
    const isAdult = url.searchParams.get("isAdult") === "true";
    // ID real de Mongo (session.user.id) — necesario para poder
    // ligar el historial de chat y las denuncias a una cuenta real, no solo
    // a un ID de conexión de WebSocket que cambia cada partida (ver
    // AGENTS.md §6.6).
    const playerId = url.searchParams.get("playerId") ?? connection.id;

    this.players.set(connection.id, { id: connection.id, displayName, planet, isAdult, playerId });

    if (this.players.size === 1 && !this.lobbyTimer) {
      this.leaderPlayerId = playerId;
      this.lobbyEndsAt = Date.now() + LOBBY_DURATION_MS;
      this.lobbyTimer = setTimeout(() => this.startGame(), LOBBY_DURATION_MS);
    }

    this.broadcastRoster();
    this.notifyDirectory();
  }

  onMessage(sender: Connection, message: string) {
    let data: ClientMessage;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (data.type === "position") {
      this.broadcastMsg({ type: "position", id: sender.id, x: data.x, y: data.y }, [sender.id]);
    } else if (data.type === "startNow" && this.status === "lobby") {
      this.startGame();
    } else if (data.type === "jupiterShield") {
      // Bono de compañero de Júpiter (ver AGENTS.md §5) — solo reenvía al
      // jugador puntual que Júpiter eligió como objetivo (ya validado del
      // lado del cliente por cercanía); si ya no está en la sala (se
      // desconectó justo antes), simplemente no llega a nadie.
      const senderInfo = this.players.get(sender.id);
      const target = [...this.getConnections()].find((c) => c.id === data.targetId);
      if (target && senderInfo) {
        target.send(
          JSON.stringify({
            type: "jupiterShielded",
            fromDisplayName: senderInfo.displayName,
            durationMs: data.durationMs,
          } satisfies ServerMessage),
        );
      }
    } else if (data.type === "chat") {
      // Chat en vivo (ver AGENTS.md §6.5/§6.6) — el servidor es quien decide
      // si se reenvía, NUNCA el cliente: aunque el botón de chat esté oculto
      // en la UI de un menor, un cliente modificado no podría forzar el
      // envío igual, porque esta comprobación es la que realmente importa.
      const senderInfo = this.players.get(sender.id);
      if (!senderInfo) return;
      const allAdult = this.players.size > 0 && [...this.players.values()].every((p) => p.isAdult);
      if (!allAdult) return;

      const trimmed = data.message.slice(0, 300).trim();
      if (!trimmed) return;

      const chatMessage: ServerMessage = {
        type: "chat",
        id: sender.id,
        displayName: senderInfo.displayName,
        message: trimmed,
        sentAt: Date.now(),
      };
      // A todos, incluido quien lo mandó — así todos ven exactamente el
      // mismo texto recortado/timestamp que quedó del lado del servidor, en
      // vez de que el emisor confíe en su propia copia local.
      this.broadcastMsg(chatMessage);
      this.logChatMessage(senderInfo.playerId, senderInfo.displayName, trimmed);
    } else if (data.type === "faceReaction") {
      // Reacción facial al recibir daño (ver AGENTS.md §5.1) — relay
      // simple, igual que "position": cada cliente decide su propia
      // reacción localmente, el servidor solo la reenvía a los demás.
      this.broadcastMsg({ type: "faceReaction", id: sender.id, expression: data.expression }, [sender.id]);
    } else if (data.type === "playerDefeated") {
      // Secuencia de muerte — pedido explícito del usuario: "la explosión
      // y la frase épica también son vistas por los demás jugadores".
      const senderInfo = this.players.get(sender.id);
      if (!senderInfo) return;
      this.broadcastMsg(
        { type: "playerDefeated", id: sender.id, displayName: senderInfo.displayName, defeatPhrase: data.defeatPhrase },
        [sender.id],
      );
    } else if (data.type === "abilityState") {
      // Visibilidad de habilidad en equipo (ver AGENTS.md §8) — relay simple.
      this.broadcastMsg({ type: "abilityState", id: sender.id, active: data.active }, [sender.id]);
    } else if (data.type === "playerStatus") {
      // Panel informativo de vidas/estrellas del equipo — relay simple.
      this.broadcastMsg({ type: "playerStatus", id: sender.id, lives: data.lives, stars: data.stars }, [sender.id]);
    } else if (data.type === "teamProgress") {
      // Nivel/marcador de agujeros negros compartido en equipo — relay
      // simple; cada cliente adopta `Math.max` para el nivel y suma +1 a su
      // contador local de agujeros negros derrotados por el equipo.
      this.broadcastMsg({ type: "teamProgress", id: sender.id, level: data.level }, [sender.id]);
    } else if (data.type === "passiveBoost") {
      // Pasiva de pulsares de Saturno compartida con TODO el equipo — relay
      // simple, ver AGENTS.md §8.2.
      this.broadcastMsg({ type: "passiveBoost", id: sender.id, pulsarSpawnBoost: data.pulsarSpawnBoost }, [sender.id]);
    }
  }

  /**
   * Persiste el mensaje en Mongo vía la app de Next.js — ver AGENTS.md §6.6
   * ("todas las conversaciones se deberán guardar en mongo como un
   * histórico"). El party server no tiene el driver de Mongo (corre en un
   * runtime de Cloudflare Durable Objects, no Node.js "completo") — por eso
   * se hace un POST de servicio-a-servicio a /api/chat/log en vez de
   * escribir directo a la base de datos, mismo patrón que `notifyDirectory`
   * usa para el party "directory". Fire-and-forget: si falla, el chat en
   * vivo ya se entregó igual, solo se pierde ese registro del histórico.
   */
  private logChatMessage(playerId: string, displayName: string, message: string) {
    const appOrigin = this.env?.APP_ORIGIN ?? "http://localhost:3000";
    const secret = this.env?.PARTYKIT_SHARED_SECRET;
    if (!secret) return; // sin secreto configurado, no se intenta (ver party/.env)

    fetch(`${appOrigin}/api/chat/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-party-secret": secret },
      body: JSON.stringify({ roomId: this.name, playerId, displayName, message }),
    }).catch(() => {
      // Solo histórico/moderación — nunca debe tumbar el chat en vivo.
    });
  }

  onClose(connection: Connection) {
    // `onConnect` puede cerrar una conexión rechazada (sala llena / partida
    // en curso) antes de agregarla a `players` — ese cierre no debe emitir
    // un "playerLeft" fantasma para un jugador que nunca llegó a unirse.
    if (!this.players.delete(connection.id)) return;
    this.broadcastMsg({ type: "playerLeft", id: connection.id });

    if (this.players.size === 0) {
      if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
      this.lobbyTimer = undefined;
      this.status = "lobby";
      // Sala vacía = lista para una partida nueva en el mismo código de
      // sala — el próximo en conectarse será el líder de esa partida nueva.
      this.leaderPlayerId = null;
    } else {
      this.broadcastRoster();
    }
    this.notifyDirectory();
  }

  private startGame() {
    if (this.status === "playing") return;
    this.status = "playing";
    if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
    const seed = Math.floor(Math.random() * 2 ** 31);
    // Margen para que todos los clientes reciban el mensaje y muestren
    // "creando sesión del juego" antes de que arranque el reloj compartido
    // (deja espacio a preparar algo server-side si hiciera falta) — ver
    // AGENTS.md §8.
    this.broadcastMsg({ type: "gameStart", seed, startAt: Date.now() + 1200 });
    this.notifyDirectory();
  }

  private broadcastRoster() {
    this.broadcastMsg({
      type: "roster",
      players: Array.from(this.players.values()),
      status: this.status,
      lobbyEndsAt: this.lobbyEndsAt,
      leaderPlayerId: this.leaderPlayerId,
    });
  }

  /** Publica el resumen de esta sala en el party "directory" — ver AGENTS.md §8.1. */
  private async notifyDirectory() {
    const update: DirectoryUpdate =
      this.players.size === 0
        ? { roomId: this.name, remove: true }
        : {
            roomId: this.name,
            playerCount: this.players.size,
            maxPlayers: MAX_PLAYERS,
            status: this.status,
            planetsTaken: Array.from(this.players.values()).map((p) => p.planet),
          };

    try {
      const directoryStub = await getServerByName<Env, Directory>(this.env.DIRECTORY, "global");
      await directoryStub.receiveUpdate(update);
    } catch {
      // El directorio es solo una vista de conveniencia; si falla, la
      // sala real sigue funcionando (el chequeo de cupo en onConnect es
      // la fuente de verdad) — ver AGENTS.md §8.1.
    }
  }
}
