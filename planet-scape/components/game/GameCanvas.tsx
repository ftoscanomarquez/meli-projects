"use client";

import { useEffect, useRef, useState } from "react";
import { GameEngine } from "@/engine/GameEngine";
import type { PlanetKey } from "@/engine/characterSvg";
import type { MultiplayerConfig } from "@/engine/multiplayer/types";
import type { MusicChoice } from "@/engine/audio/backgroundMusic";
import { DEFAULT_GAME_CONFIG, type GameConfig } from "@/lib/schemas/gameConfig";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { clientLog } from "@/lib/clientLog";
import { GameHud } from "./GameHud";
import { MusicPicker } from "./MusicPicker";
import { ChatPanel } from "./ChatPanel";
import styles from "./GameCanvas.module.css";

/**
 * Motor de juego (Fase 3) — ver AGENTS.md §5.1 regla `bundle-dynamic-imports`:
 * este componente solo se carga vía `next/dynamic(..., { ssr: false })`
 * desde la ruta de partida, nunca en el bundle inicial de la landing.
 * `multiplayerConfig` es opcional — sin él, el motor se comporta exactamente
 * igual que en Fase 3-4 (solo, determinista con semilla real).
 */
export function GameCanvas({
  planet,
  multiplayerConfig,
  gameConfig,
}: {
  planet: PlanetKey;
  multiplayerConfig?: MultiplayerConfig;
  gameConfig?: GameConfig;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const { session } = useGlobalContext();
  // Paso "antes de jugar" (MusicPicker) — pedido explícito del usuario
  // (2026-07-22): elegir la música (una de las 4 o subir la propia) antes de
  // que el motor monte, en vez de que suene algo elegido por defecto sin
  // preguntar. El clic en "¡Jugar!" también sirve como el primer gesto del
  // usuario que los navegadores exigen para permitir audio.
  const [ready, setReady] = useState(false);
  const musicChoiceRef = useRef<MusicChoice | undefined>(undefined);
  // Trazabilidad de montaje/desmontaje del motor — agregado 2026-07-22 para
  // investigar un bug real reportado en vivo (el juego "se reinicia solo" a
  // nivel 0 sin ningún mensaje de derrota, ver RETROSPECTIVA.md): si esto
  // vuelve a pasar, `logs/app.log` debe mostrar exactamente cuántas veces se
  // montó el motor en la sesión y si las dependencias del efecto realmente
  // cambiaron o fue un remount inesperado (ej. Fast Refresh en desarrollo).
  const prevDepsRef = useRef<{ planet: PlanetKey; multiplayerConfig?: MultiplayerConfig; gameConfig?: GameConfig } | null>(null);

  useEffect(() => {
    if (!ready) return;
    const container = containerRef.current;
    if (!container) return;

    const mountId = Math.random().toString(36).slice(2, 8);
    const prev = prevDepsRef.current;
    clientLog("info", "game.canvas.mount", {
      mountId,
      planet,
      planetChanged: prev ? prev.planet !== planet : "first-mount",
      multiplayerConfigRefChanged: prev ? prev.multiplayerConfig !== multiplayerConfig : "first-mount",
      gameConfigRefChanged: prev ? prev.gameConfig !== gameConfig : "first-mount",
    });
    prevDepsRef.current = { planet, multiplayerConfig, gameConfig };

    // Contador de popularidad (❤️ en el carrusel de la landing) — ver
    // AGENTS.md §2.3. Se dispara al montar el motor de verdad (partida
    // realmente iniciada), no al solo seleccionar el planeta en el
    // carrusel. Informativo, sin bloquear nada si falla.
    void fetch("/api/planets/played", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planet }),
    }).catch(() => {});

    const engine = new GameEngine(planet, multiplayerConfig, gameConfig, session?.stars ?? 0, musicChoiceRef.current);
    engineRef.current = engine;
    void engine.mount(container);

    // PC: Spacebar o clic izquierdo. Móvil: botón flotante (GameHud) — ver AGENTS.md §5.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        engine.handleActionPress();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      // El movimiento con mouse/touchpad sigue al cursor sin necesitar clic
      // (ver InputController) — un clic normal siempre activa la habilidad.
      if (e.pointerType === "mouse") engine.handleActionPress();
    };

    window.addEventListener("keydown", onKeyDown);
    container.addEventListener("pointerup", onPointerUp);

    return () => {
      clientLog("info", "game.canvas.effect_cleanup", { mountId, planet });
      window.removeEventListener("keydown", onKeyDown);
      container.removeEventListener("pointerup", onPointerUp);
      engine.destroy();
      engineRef.current = null;
    };
    // `session.stars` se lee solo como valor inicial del HUD al montar el
    // motor — no debe remontarlo si cambia a mitad de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, planet, multiplayerConfig, gameConfig]);

  if (!ready) {
    return (
      <MusicPicker
        onConfirm={(choice) => {
          musicChoiceRef.current = choice;
          setReady(true);
        }}
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.canvasHost} />
      <GameHud
        planet={planet}
        isMultiplayer={!!multiplayerConfig}
        onAbilityPress={() => engineRef.current?.activateAbility()}
        onBlackHoleAttack={() => engineRef.current?.attackBlackHole()}
        onToggleMusic={() => engineRef.current?.toggleMusicMuted()}
        onExitConfirmed={() => engineRef.current?.reportManualExit()}
        gameConfig={gameConfig ?? DEFAULT_GAME_CONFIG}
      />
      {/* Chat en vivo (ver AGENTS.md §6.5) — solo existe en el DOM cuando hay
          multijugador y TODOS los jugadores de la sala son mayores de edad
          (calculado server-side, ver useRoomConnection.ts). */}
      {multiplayerConfig?.allPlayersAdult && <ChatPanel multiplayerConfig={multiplayerConfig} />}
    </div>
  );
}
