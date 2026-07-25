"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./Admin.module.css";

type ChatRow = {
  id: string;
  roomId: string;
  playerId: string;
  displayName: string;
  message: string;
  sentAt: string;
  flagged: boolean;
  flagReasons: string[];
};

/**
 * Búsqueda del histórico de chat en vivo — pedido explícito del usuario
 * (2026-07-22, ver AGENTS.md §6.6): "un administrador podrá buscar en las
 * conversaciones cosas sospechosas... deben marcarse como conversaciones
 * prioritarias a revisar". Los mensajes marcados por lib/chatModeration.ts
 * aparecen primero (ver app/api/admin/chat/route.ts) y resaltados en rojo.
 */
export function AdminChatPanel() {
  const t = useTranslations("Admin");
  const [roomId, setRoomId] = useState("");
  const [alias, setAlias] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (roomId.trim()) params.set("roomId", roomId.trim());
    if (alias.trim()) params.set("alias", alias.trim());
    if (flaggedOnly) params.set("flaggedOnly", "true");
    const res = await fetch(`/api/admin/chat?${params.toString()}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setSearched(true);
    setLoading(false);
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>{t("chatSectionTitle")}</h2>

      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t("chatRoomIdPlaceholder")}
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t("chatAliasPlaceholder")}
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
        />
        <button type="submit" className={styles.searchButton}>
          {t("searchButton")}
        </button>
      </form>

      <label className={styles.includeReadRow}>
        <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
        {t("chatFlaggedOnlyLabel")}
      </label>

      {loading && <p className={styles.status}>{t("loading")}</p>}
      {searched && !loading && messages.length === 0 && <p className={styles.status}>{t("noResults")}</p>}

      <ul className={styles.playerList}>
        {messages.map((m) => (
          <li key={m.id} className={styles.feedbackRow} data-read={!m.flagged}>
            <div className={styles.feedbackMeta}>
              <span>
                {m.flagged ? "🚨 " : ""}
                <strong>{m.displayName}</strong> · {t("chatRoomLabel")}: {m.roomId}
              </span>
              <span className={styles.status}>{new Date(m.sentAt).toLocaleString()}</span>
            </div>
            <p className={styles.feedbackMessage}>{m.message}</p>
            {m.flagged && (
              <p className={styles.status} data-tone="error">
                {t("chatFlagReasons")}: {m.flagReasons.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
