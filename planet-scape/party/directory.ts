import { Server, type Connection } from "partyserver";
import type { DirectoryMessage, DirectoryUpdate, OpenRoomSummary } from "./messages";
import type { Env } from "./worker";

/**
 * Directorio de salas abiertas — ver AGENTS.md §8.1. Sala única y fija
 * ("global"); cada `GameRoom` llama a `receiveUpdate()` (RPC directo sobre
 * el Durable Object, ver partyserver#getServerByName) al conectarse,
 * desconectarse o arrancar (ver `party/gameRoom.ts#notifyDirectory`). Los
 * clientes en la pantalla "crear/unirse a sala" se conectan por WebSocket
 * a este party y reciben la lista completa en cada cambio.
 *
 * Migrado de "partykit" a "partyserver" (ver docs/PRE-PROD.md Fase 5) — la
 * única diferencia real respecto al `onRequest`/`fetch` que usaba antes es
 * que `GameRoom` ahora llama a este método directamente vía RPC (más simple
 * y nativo de Durable Objects) en vez de mandar un POST HTTP interno.
 */
export default class Directory extends Server<Env> {
  rooms = new Map<string, OpenRoomSummary>();

  onConnect(connection: Connection) {
    connection.send(JSON.stringify(this.listMessage()));
  }

  receiveUpdate(update: DirectoryUpdate) {
    if ("remove" in update) {
      this.rooms.delete(update.roomId);
    } else {
      this.rooms.set(update.roomId, update);
    }
    this.broadcast(JSON.stringify(this.listMessage()));
  }

  private listMessage(): DirectoryMessage {
    return { type: "list", rooms: Array.from(this.rooms.values()) };
  }
}
