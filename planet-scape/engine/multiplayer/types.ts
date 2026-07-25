import type { PlanetKey } from "../characterSvg";
import type { FaceExpression } from "../../party/messages";

/**
 * Contrato entre GameEngine y la capa de red (lib/multiplayer/RoomConnection) —
 * ver AGENTS.md §8. GameEngine no sabe nada de WebSockets ni de PartyKit,
 * solo de estas funciones — así el motor single-player (sin este config)
 * sigue funcionando exactamente igual que en Fase 3-4.
 */
export type RemotePlayerInfo = {
  id: string;
  displayName: string;
  planet: PlanetKey;
};

// Mensaje de chat ya reenviado por el servidor (ver party/messages.ts) —
// `id` es el ID de conexión de PartyKit de quien lo mandó, usado para
// distinguir "tú"/"otro" en la UI del chat, igual que con las posiciones.
export type ChatMessageInfo = {
  id: string;
  displayName: string;
  message: string;
  sentAt: number;
};

export type MultiplayerConfig = {
  /** Semilla compartida — todos los clientes de la sala generan el mismo mundo. */
  seed: number;
  /** Para adjuntar al reporte de fin de partida — ver AGENTS.md §7 y §8. */
  roomId: string;
  // Alias del jugador local — pedido explícito del usuario (2026-07-22):
  // cuando dos jugadores eligen el mismo planeta, deben distinguirse por su
  // alias mostrado encima del sprite (ver GameEngine.ts, azul fuerte = tú
  // mismo, gris delgado = los demás — AGENTS.md §6.4).
  localDisplayName: string;
  initialRoster: RemotePlayerInfo[];
  sendPosition: (x: number, y: number) => void;
  onPositionUpdate: (cb: (id: string, x: number, y: number) => void) => () => void;
  onPlayerJoined: (cb: (player: RemotePlayerInfo) => void) => () => void;
  onPlayerLeft: (cb: (id: string) => void) => () => void;
  // Bono de compañero de Júpiter en multijugador (2026-07-22, ver
  // AGENTS.md §5 y jupiterAbility.ts) — Júpiter ya conoce la posición de
  // los demás localmente (remotePlayers), así que elige el objetivo y solo
  // pide reenviar el aviso a ESE jugador puntual.
  sendJupiterShield: (targetId: string, durationMs: number) => void;
  onJupiterShielded: (cb: (fromDisplayName: string, durationMs: number) => void) => () => void;
  // Chat en vivo (2026-07-22, ver AGENTS.md §6.5/§6.6) — habilitado SOLO
  // cuando todos los jugadores conectados a la sala son mayores de edad
  // (calculado server-side por party/gameRoom.ts a partir de `isAdult` en el
  // roster, nunca confiado únicamente del lado del cliente). `ChatPanel.tsx`
  // usa este flag para decidir si se muestra el botón/panel de chat.
  allPlayersAdult: boolean;
  sendChatMessage: (message: string) => void;
  onChatMessage: (cb: (msg: ChatMessageInfo) => void) => () => void;
  // Reacciones faciales y secuencia de muerte visibles para los demás
  // jugadores (2026-07-22, ver AGENTS.md §5.1) — pedido explícito del
  // usuario: "la explosión y la frase épica también son vistas por los
  // demás jugadores". Cada cliente decide su propia reacción/secuencia
  // localmente (ver FaceOverlay.ts) y solo avisa a los demás.
  sendFaceReaction: (expression: FaceExpression) => void;
  onFaceReaction: (cb: (id: string, expression: FaceExpression) => void) => () => void;
  sendPlayerDefeated: (defeatPhrase: string) => void;
  onPlayerDefeated: (cb: (id: string, displayName: string, defeatPhrase: string) => void) => () => void;
  // Visibilidad de habilidad/progreso en equipo (2026-07-23, ver AGENTS.md
  // §8) — pedido explícito del usuario: las habilidades activas y el
  // nivel/marcador de agujeros negros derrotados deben verse igual en
  // todas las sesiones de la sala, no solo en la de quien las activó.
  sendAbilityState: (active: boolean) => void;
  onAbilityState: (cb: (id: string, active: boolean) => void) => () => void;
  // Puramente informativo (panel desplegable de vidas/estrellas del
  // equipo, ver GameHud.tsx) — nunca fuerza el estado del jugador local.
  sendPlayerStatus: (lives: number, stars: number) => void;
  onPlayerStatus: (cb: (id: string, lives: number, stars: number) => void) => () => void;
  sendTeamProgress: (level: number) => void;
  onTeamProgress: (cb: (id: string, level: number) => void) => () => void;
  // El jugador local creó la sala (el primero en conectarse) — pedido
  // explícito del usuario (2026-07-23): resaltar su alias en el Top 5 de
  // equipos, ver GameEngine.ts#reportSessionComplete y RoomLeaderboardWidget.tsx.
  isLeader: boolean;
  // Pasiva de pulsares de Saturno compartida con TODO el equipo (2026-07-23,
  // ver AGENTS.md §8.2) — pedido explícito del usuario: "a todos los
  // integrantes de la sala les comparte esa habilidad pasiva". A diferencia
  // de la ayuda por proximidad de las demás habilidades, esta es de sala
  // completa sin importar la distancia.
  sendPassiveBoost: (pulsarSpawnBoost: number) => void;
  onPassiveBoost: (cb: (id: string, pulsarSpawnBoost: number) => void) => () => void;
};
