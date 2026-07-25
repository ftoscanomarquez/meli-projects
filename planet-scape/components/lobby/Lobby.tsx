"use client";

import { useSearchParams } from "next/navigation";
import type { PlanetKey } from "@/engine/characterSvg";
import type { GameConfig } from "@/lib/schemas/gameConfig";
import { RoomEntry } from "./RoomEntry";
import { RoomView } from "./RoomView";

export function Lobby({ planet, gameConfig }: { planet: PlanetKey; gameConfig: GameConfig }) {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  if (!roomId) {
    return <RoomEntry planet={planet} />;
  }

  return <RoomView planet={planet} roomId={roomId} gameConfig={gameConfig} />;
}
