"use client";

import { useEffect } from "react";
import { clientLog } from "@/lib/clientLog";

/**
 * Captura errores no atrapados y promesas rechazadas en TODA la app y los
 * manda al logger del servidor (ver lib/clientLog.ts) — agregado 2026-07-22
 * para poder investigar un bug real reportado en vivo ("el juego se
 * reinicia solo, sin ningún mensaje de derrota") que le pasó en el celular
 * de otro jugador, donde no hay forma de ver la consola del navegador. No
 * reemplaza el patrón de Toast pendiente (ver AGENTS.md §15) — es
 * puramente de diagnóstico, no le muestra nada al jugador.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      clientLog("error", "window.error", {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      clientLog("error", "window.unhandledrejection", {
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
