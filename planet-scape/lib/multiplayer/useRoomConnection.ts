"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import type { ServerMessage, RosterPlayer, FaceExpression } from "../../party/messages";
import type { MultiplayerConfig, RemotePlayerInfo, ChatMessageInfo } from "../../engine/multiplayer/types";
import type { PlanetKey } from "../../engine/characterSvg";
import { getPartyKitHost } from "./partykitHost";

// "starting" — sala completa/arrancada, esperando a `startAt` antes de
// montar el motor de verdad (deja un margen para preparar algo server-side
// si hiciera falta, ver AGENTS.md §8) — no confundir con "playing", que es
// cuando el `GameCanvasLoader` ya está montado.
type RoomStatus = "connecting" | "lobby" | "starting" | "playing";
type PositionListener = (id: string, x: number, y: number) => void;
type PlayerListener = (info: RemotePlayerInfo) => void;
type LeftListener = (id: string) => void;
type ShieldedListener = (fromDisplayName: string, durationMs: number) => void;
type ChatListener = (msg: ChatMessageInfo) => void;
type FaceReactionListener = (id: string, expression: FaceExpression) => void;
type PlayerDefeatedListener = (id: string, displayName: string, defeatPhrase: string) => void;
type AbilityStateListener = (id: string, active: boolean) => void;
type PlayerStatusListener = (id: string, lives: number, stars: number) => void;
type TeamProgressListener = (id: string, level: number) => void;
type PassiveBoostListener = (id: string, pulsarSpawnBoost: number) => void;

/**
 * Conecta a una sala de PartyKit — ver AGENTS.md §8. Expone el estado del
 * lobby para la UI y un `MultiplayerConfig` estable para pasarle a
 * GameEngine una vez que la partida arranca.
 */
export function useRoomConnection(params: {
  roomId: string;
  displayName: string;
  planet: PlanetKey;
  // Chat en vivo (ver AGENTS.md §6.5/§6.6) — `isAdult` viaja en la query de
  // conexión (mismo nivel de confianza que `displayName`/`planet`, ya
  // client-authoritative en este proyecto); `playerId` es el _id real de
  // Mongo, para ligar el chat/denuncias a una cuenta real.
  isAdult: boolean;
  playerId: string;
}) {
  const { roomId, displayName, planet, isAdult, playerId } = params;
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [lobbyEndsAt, setLobbyEndsAt] = useState(0);
  const [gameStart, setGameStart] = useState<{ seed: number; startAt: number } | null>(null);
  const [roomFull, setRoomFull] = useState(false);
  const [localId, setLocalId] = useState("");
  // Alias del líder de la sala (el primero en conectarse, ver
  // party/gameRoom.ts) — pedido explícito del usuario (2026-07-23): "de
  // nombre debe de salir el alias del lider que creo la sala... solo
  // resalta el del lider" (en el Top 5 de equipos, ver RoomLeaderboardWidget.tsx).
  const [leaderPlayerId, setLeaderPlayerId] = useState<string | null>(null);

  // Los listeners no disparan re-render por sí mismos (GameEngine los
  // consume fuera de React) — un ref es correcto aquí, solo se lee/escribe
  // en efectos/callbacks, nunca durante el render.
  const positionListeners = useRef(new Set<PositionListener>());
  const joinedListeners = useRef(new Set<PlayerListener>());
  const leftListeners = useRef(new Set<LeftListener>());
  const shieldedListeners = useRef(new Set<ShieldedListener>());
  const chatListeners = useRef(new Set<ChatListener>());
  const faceReactionListeners = useRef(new Set<FaceReactionListener>());
  const playerDefeatedListeners = useRef(new Set<PlayerDefeatedListener>());
  const abilityStateListeners = useRef(new Set<AbilityStateListener>());
  const playerStatusListeners = useRef(new Set<PlayerStatusListener>());
  const teamProgressListeners = useRef(new Set<TeamProgressListener>());
  const passiveBoostListeners = useRef(new Set<PassiveBoostListener>());

  const socket = usePartySocket({
    host: getPartyKitHost(),
    room: roomId,
    query: { name: displayName, planet, isAdult: String(isAdult), playerId },
    onOpen() {
      setLocalId(socket.id);
      setStatus("lobby");
    },
    onMessage(event: MessageEvent<string>) {
      const data: ServerMessage = JSON.parse(event.data);
      if (data.type === "roster") {
        setPlayers(data.players);
        setLobbyEndsAt(data.lobbyEndsAt);
        setLeaderPlayerId(data.leaderPlayerId);
        // El estado "playing"/"starting" lo maneja únicamente `gameStart`
        // (ver abajo) — un roster tardío no debe saltarse la pantalla de
        // "creando sesión del juego" ni el motor ya montado.
        if (data.status === "lobby") setStatus("lobby");
      } else if (data.type === "gameStart") {
        setGameStart({ seed: data.seed, startAt: data.startAt });
        setStatus("starting");
      } else if (data.type === "position") {
        for (const listener of positionListeners.current) listener(data.id, data.x, data.y);
      } else if (data.type === "playerLeft") {
        for (const listener of leftListeners.current) listener(data.id);
      } else if (data.type === "roomFull") {
        setRoomFull(true);
      } else if (data.type === "jupiterShielded") {
        for (const listener of shieldedListeners.current) listener(data.fromDisplayName, data.durationMs);
      } else if (data.type === "chat") {
        for (const listener of chatListeners.current) {
          listener({ id: data.id, displayName: data.displayName, message: data.message, sentAt: data.sentAt });
        }
      } else if (data.type === "faceReaction") {
        for (const listener of faceReactionListeners.current) listener(data.id, data.expression);
      } else if (data.type === "playerDefeated") {
        for (const listener of playerDefeatedListeners.current) listener(data.id, data.displayName, data.defeatPhrase);
      } else if (data.type === "abilityState") {
        for (const listener of abilityStateListeners.current) listener(data.id, data.active);
      } else if (data.type === "playerStatus") {
        for (const listener of playerStatusListeners.current) listener(data.id, data.lives, data.stars);
      } else if (data.type === "teamProgress") {
        for (const listener of teamProgressListeners.current) listener(data.id, data.level);
      } else if (data.type === "passiveBoost") {
        for (const listener of passiveBoostListeners.current) listener(data.id, data.pulsarSpawnBoost);
      }
    },
  });

  const startNow = useCallback(() => {
    socket.send(JSON.stringify({ type: "startNow" }));
  }, [socket]);

  // Pantalla "creando sesión del juego" — ver AGENTS.md §8. Se muestra
  // durante el margen que el servidor ya reserva entre `gameStart` y
  // `startAt`, luego monta el motor de verdad.
  useEffect(() => {
    if (!gameStart) return;
    const delay = Math.max(0, gameStart.startAt - Date.now());
    const timer = window.setTimeout(() => setStatus("playing"), delay);
    return () => window.clearTimeout(timer);
  }, [gameStart]);

  // Referencia estable para GameEngine — ver engine/multiplayer/types.ts.
  // `gameStart` cambia UNA SOLA VEZ por partida (`null` → el objeto real,
  // fijado por el servidor cuando arranca — ver `party/gameRoom.ts#startGame()`,
  // nunca se vuelve a llamar dos veces por sala) y nunca vuelve a cambiar
  // después — por eso es la única dependencia que debe disparar este
  // cálculo. `initialRoster`/`allPlayersAdult` SÍ leen `players`, pero a
  // propósito NO está en el arreglo de dependencias.
  const multiplayerConfig: MultiplayerConfig | null = useMemo(() => {
    if (!gameStart) return null;
    return {
      seed: gameStart.seed,
      roomId,
      localDisplayName: displayName,
      initialRoster: players
        .filter((p) => p.id !== localId)
        .map((p) => ({ id: p.id, displayName: p.displayName, planet: p.planet })),
      // Ver comentario de `leaderPlayerId` arriba — quién creó la sala,
      // usado para resaltarlo en el Top 5 de equipos.
      isLeader: leaderPlayerId !== null && leaderPlayerId === playerId,
      sendPosition: (x, y) => socket.send(JSON.stringify({ type: "position", x, y })),
      onPositionUpdate: (cb) => {
        positionListeners.current.add(cb);
        return () => positionListeners.current.delete(cb);
      },
      onPlayerJoined: (cb) => {
        joinedListeners.current.add(cb);
        return () => joinedListeners.current.delete(cb);
      },
      onPlayerLeft: (cb) => {
        leftListeners.current.add(cb);
        return () => leftListeners.current.delete(cb);
      },
      sendJupiterShield: (targetId, durationMs) =>
        socket.send(JSON.stringify({ type: "jupiterShield", targetId, durationMs })),
      onJupiterShielded: (cb) => {
        shieldedListeners.current.add(cb);
        return () => shieldedListeners.current.delete(cb);
      },
      // Todos los jugadores presentes AL ARRANCAR la partida deben ser
      // mayores de edad — pedido explícito del usuario (2026-07-22, ver
      // AGENTS.md §6.5). Se calcula aquí, dentro de un `useMemo` que solo se
      // re-ejecuta cuando cambia `gameStart` (ver comentario arriba) — no
      // se re-evalúa si alguien se desconecta/entra a mitad de partida.
      allPlayersAdult: players.length > 0 && players.every((p) => p.isAdult),
      sendChatMessage: (message) => socket.send(JSON.stringify({ type: "chat", message })),
      onChatMessage: (cb) => {
        chatListeners.current.add(cb);
        return () => chatListeners.current.delete(cb);
      },
      sendFaceReaction: (expression) => socket.send(JSON.stringify({ type: "faceReaction", expression })),
      onFaceReaction: (cb) => {
        faceReactionListeners.current.add(cb);
        return () => faceReactionListeners.current.delete(cb);
      },
      sendPlayerDefeated: (defeatPhrase) => socket.send(JSON.stringify({ type: "playerDefeated", defeatPhrase })),
      onPlayerDefeated: (cb) => {
        playerDefeatedListeners.current.add(cb);
        return () => playerDefeatedListeners.current.delete(cb);
      },
      sendAbilityState: (active) => socket.send(JSON.stringify({ type: "abilityState", active })),
      onAbilityState: (cb) => {
        abilityStateListeners.current.add(cb);
        return () => abilityStateListeners.current.delete(cb);
      },
      sendPlayerStatus: (lives, stars) => socket.send(JSON.stringify({ type: "playerStatus", lives, stars })),
      onPlayerStatus: (cb) => {
        playerStatusListeners.current.add(cb);
        return () => playerStatusListeners.current.delete(cb);
      },
      sendTeamProgress: (level) => socket.send(JSON.stringify({ type: "teamProgress", level })),
      onTeamProgress: (cb) => {
        teamProgressListeners.current.add(cb);
        return () => teamProgressListeners.current.delete(cb);
      },
      sendPassiveBoost: (pulsarSpawnBoost) => socket.send(JSON.stringify({ type: "passiveBoost", pulsarSpawnBoost })),
      onPassiveBoost: (cb) => {
        passiveBoostListeners.current.add(cb);
        return () => passiveBoostListeners.current.delete(cb);
      },
    };
    // `players` a propósito NO es una dependencia — ver comentario arriba
    // del porqué de solo `[gameStart, ...]`. Bug real corregido aquí (antes
    // `players` SÍ estaba en este arreglo, así que el objeto entero se
    // recreaba con cada cambio de roster): ver AGENTS.md §8.2/RETROSPECTIVA.md.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStart, socket, localId, roomId, displayName]);

  return { status, players, lobbyEndsAt, startNow, gameStart, multiplayerConfig, roomFull, localId };
}
