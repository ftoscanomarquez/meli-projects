import pino from "pino";
import fs from "node:fs";
import path from "node:path";

/**
 * Logging estructurado — ver OBSERVABILIDAD.md.
 * Desarrollo: stdout con pino-pretty + archivo físico logs/app.log.
 * Producción: JSON a stdout (capturado por Vercel Logs).
 */

const isDev = process.env.NODE_ENV === "development";

function buildDevTransport() {
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  return pino.transport({
    targets: [
      {
        target: "pino-pretty",
        level: process.env.PINO_LOG_LEVEL ?? "info",
        options: { colorize: true },
      },
      {
        target: "pino/file",
        level: process.env.PINO_LOG_LEVEL ?? "info",
        options: { destination: path.join(logsDir, "app.log"), mkdir: true },
      },
    ],
  });
}

export const logger = isDev
  ? pino({ level: process.env.PINO_LOG_LEVEL ?? "info" }, buildDevTransport())
  : pino({ level: process.env.PINO_LOG_LEVEL ?? "info" });
