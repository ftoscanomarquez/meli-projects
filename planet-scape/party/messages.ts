/**
 * Protocolo de mensajes entre cliente y sala de PartyKit — ver AGENTS.md §8.
 * Compartido entre `party/gameRoom.ts` (servidor) y `lib/multiplayer/`
 * (cliente) para que ambos lados usen exactamente el mismo contrato.
 */
import type { PlanetKey } from "../engine/characterSvg";

export type ClientMessage =
  | { type: "position"; x: number; y: number }
  | { type: "startNow" }
  // Bono de compañero de Júpiter en multijugador (2026-07-22, ver
  // AGENTS.md §5 y engine/GameEngine.ts#activateAbility) — el cliente de
  // Júpiter ya sabe la posición de los demás (sincronizada vía "position"),
  // así que elige el objetivo él mismo y solo le pide al servidor que
  // reenvíe el aviso a ESE jugador puntual.
  | { type: "jupiterShield"; targetId: string; durationMs: number }
  // Chat en vivo (2026-07-22, ver AGENTS.md §6.5) — el cliente solo manda el
  // texto; el servidor decide si lo reenvía (ver GameRoom#allPlayersAdult).
  // Nunca se confía en que el cliente ya validó la edad de todos.
  | { type: "chat"; message: string }
  // Reacciones faciales y secuencia de muerte (2026-07-22, ver AGENTS.md
  // §5.1) — pedido explícito del usuario: "la explosión y la frase épica
  // también son vistas por los demás jugadores". El servidor solo reenvía
  // (relay simple, igual que "position") — cada cliente decide su propia
  // reacción/secuencia localmente y avisa a los demás, nunca al revés.
  | { type: "faceReaction"; expression: FaceExpression }
  | { type: "playerDefeated"; defeatPhrase: string }
  // Visibilidad de habilidad/progreso en equipo (2026-07-23, ver AGENTS.md
  // §8) — pedido explícito del usuario: "cuando activamos nuestras
  // habilidades solo se ven en nuestras sesiones, se debe de ver tambien
  // nuestra habilidad en todas las sesiones", y "cuando del lado de un
  // jugador sube un nivel automaticamente sube de nivel todos en el
  // equipo... es como el marcador de cuantos agujeros negros hemos
  // derrotado entre todos". Todos son relay simple (igual que "position"):
  // cada cliente decide/calcula localmente y solo avisa a los demás.
  | { type: "abilityState"; active: boolean }
  // Informativo únicamente (panel desplegable de vidas/estrellas del
  // equipo, ver GameHud.tsx) — nunca fuerza el estado del receptor.
  | { type: "playerStatus"; lives: number; stars: number }
  // Se manda al derrotar un agujero negro propio (level += 1 local) — los
  // demás clientes adoptan `Math.max(local, recibido)` para su propio
  // `level` (nunca baja) y suman +1 a un contador COMPARTIDO de agujeros
  // negros derrotados entre todo el equipo.
  | { type: "teamProgress"; level: number }
  // Pasiva de pulsares de Saturno compartida con TODO el equipo (2026-07-23,
  // ver AGENTS.md §8.2) — pedido explícito del usuario: "respecto a su
  // habilidad de que hace que salgan mas pulsares curativos no solo es en
  // mi sesion... a todos los integrantes de la sala les comparte esa
  // habilidad pasiva". A diferencia de la ayuda por proximidad de las demás
  // habilidades activas (ver `abilityState`), esta es pasiva y de SALA
  // completa, sin importar la distancia — se manda una sola vez al montar
  // (y de nuevo a cada jugador que se una después, para que no se la pierda).
  | { type: "passiveBoost"; pulsarSpawnBoost: number };

// Definido aquí (protocolo de red) en vez de en engine/entities/FaceOverlay.ts
// para que ninguno de los dos lados tenga que importar del otro —
// FaceOverlay.ts importa este tipo, `party/gameRoom.ts` (Cloudflare Durable
// Objects) solo reenvía el mensaje sin necesitar la clase en sí.
export type FaceExpression = "crossEyes" | "surprise" | "fear" | "tongueOut" | "grimace" | "dizzySpiral" | "stars";

export type RosterPlayer = {
  id: string;
  displayName: string;
  planet: PlanetKey;
  // Edad autodeclarada (ver lib/ageUtils.ts) — nunca la fecha de nacimiento
  // real, solo el booleano ya calculado en el servidor de Next.js al hacer
  // login. El servidor de PartyKit la usa SOLO para decidir si habilita el
  // chat de la sala (AGENTS.md §6.5) — enforcement real, no solo de UI.
  isAdult: boolean;
  // ID real de Mongo (`session.user.id`), no el ID de conexión de WebSocket
  // (que cambia cada partida) — liga el chat/denuncias a una cuenta real,
  // ver AGENTS.md §6.6.
  playerId: string;
};

export type ServerMessage =
  // `leaderPlayerId` — el jugador que creó la sala (el primero en conectarse
  // — ver AGENTS.md §8.2), para resaltar su alias en el Top 5 de equipos
  // (pedido explícito del usuario 2026-07-23: "de nombre debe de salir el
  // alias del lider que creo la sala... solo resalta el del lider"). `null`
  // solo puede pasar en el instante teórico sin nadie conectado todavía.
  | { type: "roster"; players: RosterPlayer[]; status: "lobby" | "playing"; lobbyEndsAt: number; leaderPlayerId: string | null }
  | { type: "gameStart"; seed: number; startAt: number }
  | { type: "position"; id: string; x: number; y: number }
  | { type: "playerLeft"; id: string }
  | { type: "roomFull" }
  | { type: "jupiterShielded"; fromDisplayName: string; durationMs: number }
  // Reenvío de un mensaje de chat ya aceptado por el servidor (todos
  // adultos) — incluye `chatEnabled` en cada roster para que el cliente
  // sepa mostrar/ocultar el botón sin tener que inferirlo él mismo de la
  // lista de jugadores (evita duplicar esa lógica en dos lados).
  | { type: "chat"; id: string; displayName: string; message: string; sentAt: number }
  // Reenvío de reacción facial / secuencia de muerte de OTRO jugador — ver
  // AGENTS.md §5.1. `id` identifica de quién es, para dibujarla sobre el
  // sprite remoto correcto.
  | { type: "faceReaction"; id: string; expression: FaceExpression }
  | { type: "playerDefeated"; id: string; displayName: string; defeatPhrase: string }
  | { type: "abilityState"; id: string; active: boolean }
  | { type: "playerStatus"; id: string; lives: number; stars: number }
  | { type: "teamProgress"; id: string; level: number }
  | { type: "passiveBoost"; id: string; pulsarSpawnBoost: number };

/**
 * Directorio de salas abiertas (party "directory", sala fija "global") — ver
 * AGENTS.md §8.1. Cada `GameRoom` publica aquí su propio resumen al cambiar
 * de estado; el directorio solo reenvía la lista completa a quien la mira
 * desde la pantalla "crear/unirse a sala", nunca simula nada del juego.
 */
export type OpenRoomSummary = {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  status: "lobby" | "playing";
  planetsTaken: PlanetKey[];
};

export type DirectoryUpdate = OpenRoomSummary | { roomId: string; remove: true };

export type DirectoryMessage = { type: "list"; rooms: OpenRoomSummary[] };
