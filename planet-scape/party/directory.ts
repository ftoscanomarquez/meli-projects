import type * as Party from "partykit/server";
import type { DirectoryMessage, DirectoryUpdate, OpenRoomSummary } from "./messages";

/**
 * Directorio de salas abiertas — ver AGENTS.md §8.1. Sala única y fija
 * ("global"); cada `GameRoom` hace un `fetch` interno aquí al conectarse,
 * desconectarse o arrancar (ver `party/gameRoom.ts#notifyDirectory`). Los
 * clientes en la pantalla "crear/unirse a sala" se conectan por WebSocket
 * a este party y reciben la lista completa en cada cambio.
 */
export default class Directory implements Party.Server {
  rooms = new Map<string, OpenRoomSummary>();

  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection) {
    connection.send(JSON.stringify(this.listMessage()));
  }

  async onRequest(req: Party.Request) {
    if (req.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    const update = (await req.json()) as DirectoryUpdate;
    if ("remove" in update) {
      this.rooms.delete(update.roomId);
    } else {
      this.rooms.set(update.roomId, update);
    }
    this.room.broadcast(JSON.stringify(this.listMessage()));
    return new Response("ok");
  }

  private listMessage(): DirectoryMessage {
    return { type: "list", rooms: Array.from(this.rooms.values()) };
  }
}
