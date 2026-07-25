"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import type { PlanetKey } from "@/engine/characterSvg";
import { useRoomDirectory } from "@/lib/multiplayer/useRoomDirectory";
import styles from "./Lobby.module.css";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos (0/O, 1/I)
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function RoomEntry({ planet }: { planet: PlanetKey }) {
  const t = useTranslations("Lobby");
  const router = useRouter();
  const [code, setCode] = useState("");
  const openRooms = useRoomDirectory().filter((r) => r.status === "lobby");

  const goToRoom = (roomId: string) => {
    router.push(`/lobby?planet=${planet}&room=${roomId.trim().toUpperCase()}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("title")}</h1>

        {/* Pedido explícito del usuario (2026-07-22): "todos deben poder
            tener una salida... a veces si no los lleno no se cierran" —
            antes esta pantalla no tenía forma de volver salvo el botón
            "atrás" del navegador. */}
        <Link href="/" className={styles.secondaryButton}>
          {t("backToMenu")}
        </Link>

        <button type="button" className={styles.primaryButton} onClick={() => goToRoom(generateRoomCode())}>
          {t("createRoom")}
        </button>

        <span className={styles.divider}>{t("orDivider")}</span>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) goToRoom(code);
          }}
        >
          <label htmlFor="roomCode" className="sr-only">
            {t("roomCodeLabel")}
          </label>
          <input
            id="roomCode"
            className={styles.input}
            placeholder={t("roomCodePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
          />
          <button type="submit" className={styles.secondaryButton}>
            {t("joinRoom")}
          </button>
        </form>

        <div className={styles.openRooms}>
          <span className={styles.divider}>{t("openRoomsTitle")}</span>
          {openRooms.length === 0 ? (
            <p className={styles.countdown}>{t("noOpenRooms")}</p>
          ) : (
            <ul className={styles.roomList}>
              {openRooms.map((room) => {
                const isFull = room.playerCount >= room.maxPlayers;
                return (
                  <li key={room.roomId} className={styles.roomListItem}>
                    <span className={styles.roomCode}>{room.roomId}</span>
                    <span className={styles.roomCount}>
                      {room.playerCount}/{room.maxPlayers}
                    </span>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={isFull}
                      onClick={() => goToRoom(room.roomId)}
                    >
                      {isFull ? t("roomListFull") : t("joinRoom")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Link href={{ pathname: "/play", query: { planet } }} className={styles.soloLink}>
          {t("playSolo")}
        </Link>
      </div>
    </div>
  );
}
