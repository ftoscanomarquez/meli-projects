"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRoomConnection } from "@/lib/multiplayer/useRoomConnection";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { GameCanvasLoader } from "@/components/game/GameCanvasLoader";
import { Link } from "@/i18n/navigation";
import type { PlanetKey } from "@/engine/characterSvg";
import type { GameConfig } from "@/lib/schemas/gameConfig";
import styles from "./Lobby.module.css";

export function RoomView({
  planet,
  roomId,
  gameConfig,
}: {
  planet: PlanetKey;
  roomId: string;
  gameConfig: GameConfig;
}) {
  const t = useTranslations("Lobby");
  const { session } = useGlobalContext();
  const displayName = session?.displayName ?? "Jugador";

  const { status, players, lobbyEndsAt, startNow, multiplayerConfig, roomFull, localId } = useRoomConnection({
    roomId,
    displayName,
    planet,
    // Chat en vivo (ver AGENTS.md §6.5) — isAdult ya viene calculado
    // server-side en la sesión (lib/auth.ts), nunca se recalcula aquí.
    isAdult: session?.isAdult ?? false,
    playerId: session?.playerId ?? "",
  });

  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((lobbyEndsAt - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [lobbyEndsAt]);

  if (roomFull) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.error}>{t("roomFull")}</p>
          <Link href="/" className={styles.secondaryButton}>
            {t("leaveRoom")}
          </Link>
        </div>
      </div>
    );
  }

  if (status === "playing" && multiplayerConfig) {
    return <GameCanvasLoader planet={planet} multiplayerConfig={multiplayerConfig} gameConfig={gameConfig} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.shareHint}>{t("shareHint")}</p>
        {/* Antes el código venía interpolado dentro de la misma oración
            atenuada (`.shareHint`, color --ink-muted) y se perdía — pedido
            explícito del usuario (2026-07-24): "la clave que sale para
            compartir casi no se nota... haz que resalte". Elemento propio,
            grande y con marco brillante. */}
        <p className={styles.roomCode} aria-label={t("shareHint")}>
          {roomId}
        </p>

        <ul className={styles.roster}>
          {players.map((p) => (
            <li key={p.id} className={styles.rosterItem}>
              <span>{p.displayName}</span>
              {p.id === localId && <span className={styles.you}>{t("you")}</span>}
            </li>
          ))}
        </ul>

        <p className={styles.countdown}>{t("playersInRoom", { count: players.length })}</p>

        {status === "lobby" && (
          <>
            <p className={styles.countdown}>{t("waitingToStart", { seconds: secondsLeft })}</p>
            <button type="button" className={styles.primaryButton} onClick={startNow}>
              {t("startNow")}
            </button>
          </>
        )}
        {status === "connecting" && <p className={styles.countdown}>…</p>}
        {status === "starting" && <p className={styles.countdown}>{t("startingGame")}</p>}

        {/* Siempre visible — pedido real del usuario (2026-07-22): si la
            sala se queda en un estado raro (ej. 0/4 por un problema de red),
            debe poder salir e intentar de nuevo en vez de quedar atrapado. */}
        <Link href="/" className={styles.secondaryButton}>
          {t("leaveRoom")}
        </Link>
      </div>
    </div>
  );
}
