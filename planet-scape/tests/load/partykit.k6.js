import ws from "k6/ws";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

/**
 * Carga WebSocket sobre PartyKit (Fase 9) — ver AGENTS.md §11 y INFRA.md
 * §1.4. Objetivo negociado con el usuario: 100 conexiones WebSocket
 * concurrentes (25 salas de 4 jugadores) sostenidas 15 minutos sin
 * degradación. Cada VU = un jugador; se agrupan de 4 en 4 en la misma sala
 * (mismo patrón real que `party/gameRoom.ts`, MAX_PLAYERS=4) y envían
 * posiciones a ~20 msg/s, igual que `GameEngine.updateMultiplayer()`.
 *
 * Requiere `npx partykit dev` corriendo (ver QUICK-START.md).
 *
 * Uso:
 *   k6 run tests/load/partykit.k6.js                                   # smoke: 8 VUs (2 salas), 15s
 *   k6 run -e VUS=100 -e DURATION=15m tests/load/partykit.k6.js         # objetivo real (25 salas de 4)
 */
const VUS = Number(__ENV.VUS || 8);
const DURATION = __ENV.DURATION || "15s";
const PARTYKIT_HOST = __ENV.PARTYKIT_HOST || "localhost:1999";
const ROOM_SIZE = 4; // MAX_PLAYERS — ver party/gameRoom.ts

const rosterReceived = new Counter("roster_messages_received");
const connectLatency = new Trend("ws_connect_latency_ms");

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    ws_connecting: ["p(95)<1000"], // conexión establecida en <1s incluso bajo carga
    roster_messages_received: ["count>0"], // el server realmente contestó, no solo aceptó el socket
  },
};

export default function () {
  // Sala nueva por iteración/VU (como una partida real: cada sala nace
  // cuando el primer jugador se conecta) — evita reconectar en bucle a la
  // misma sala ya llena, que es lo que pasaba con un roomId fijo por VU.
  const roomIndex = Math.floor((__VU - 1) / ROOM_SIZE);
  const roomId = `LOADTEST-${__ENV.RUN_TAG || "smoke"}-${roomIndex}-${__ITER}`;
  const url = `ws://${PARTYKIT_HOST}/parties/main/${roomId}?name=LoadBot${__VU}&planet=mercury`;

  const start = Date.now();
  const res = ws.connect(url, {}, function (socket) {
    connectLatency.add(Date.now() - start);

    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "roster") rosterReceived.add(1);
      } catch (e) {
        console.error(`No se pudo parsear el mensaje en sala ${roomId} (VU ${__VU}): ${String(e)} | data=${data}`);
      }
    });

    // Mantiene la conexión abierta el resto de la duración de la prueba;
    // k6 cierra todo automáticamente al terminar (ver `options.duration`).
    socket.setTimeout(() => socket.close(), 1000 * 60 * 60);
  });

  check(res, { "conexión WebSocket exitosa (101 Switching Protocols)": (r) => r && r.status === 101 });
}
