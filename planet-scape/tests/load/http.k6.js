import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Carga HTTP (Fase 9) — ver AGENTS.md §11 y INFRA.md §1.4. Cubre los
 * endpoints públicos (no requieren Magic Link, que no es viable de simular
 * en volumen dentro de k6): health check y leaderboard. Los endpoints
 * autenticados (sessions/complete, donations/checkout, admin/*) están
 * cubiertos por Newman/Playwright uno a uno, no en volumen aquí — un
 * generador de carga con cientos de sesiones reales de Magic Link
 * requeriría cientos de correos reales vía Mailpit, no realista para este
 * proyecto (juego familiar, no una API pública de alto tráfico).
 *
 * Uso:
 *   k6 run tests/load/http.k6.js                        # smoke: 5 VUs, 15s
 *   k6 run -e VUS=50 -e DURATION=15m tests/load/http.k6.js  # objetivo real
 */
const VUS = Number(__ENV.VUS || 5);
const DURATION = __ENV.DURATION || "15s";
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% de errores
    http_req_duration: ["p(95)<800"], // p95 bajo 800ms — juego casual, no HFT
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, {
    "GET /api/health -> 200": (r) => r.status === 200,
    "GET /api/health -> mongo ok": (r) => JSON.parse(r.body).checks?.mongo === true,
  });

  const leaderboard = http.get(`${BASE_URL}/api/leaderboard`);
  check(leaderboard, {
    "GET /api/leaderboard -> 200": (r) => r.status === 200,
    "GET /api/leaderboard -> entries array": (r) => Array.isArray(JSON.parse(r.body).entries),
  });

  sleep(1);
}
