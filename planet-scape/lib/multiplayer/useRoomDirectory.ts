"use client";

import { useState } from "react";
import usePartySocket from "partysocket/react";
import type { DirectoryMessage, OpenRoomSummary } from "../../party/messages";
import { getPartyKitHost } from "./partykitHost";

/**
 * Lista en vivo de salas abiertas — ver AGENTS.md §8.1. Se conecta al party
 * "directory" (sala fija "global"); cada `GameRoom` publica ahí su propio
 * resumen, así que esta lista se actualiza sola sin hacer polling.
 */
export function useRoomDirectory() {
  const [rooms, setRooms] = useState<OpenRoomSummary[]>([]);

  usePartySocket({
    host: getPartyKitHost(),
    party: "directory",
    room: "global",
    onMessage(event: MessageEvent<string>) {
      const data: DirectoryMessage = JSON.parse(event.data);
      if (data.type === "list") setRooms(data.rooms);
    },
  });

  return rooms;
}
