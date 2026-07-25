"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./NotificationBell.module.css";

type NotificationRow = {
  id: string;
  message: string;
  kind: "admin_reply" | "strike_warning" | "account_banned";
  read: boolean;
  createdAt: string;
};

const KIND_EMOJI: Record<NotificationRow["kind"], string> = {
  admin_reply: "💬",
  strike_warning: "⚠️",
  account_banned: "🚫",
};

/**
 * Campanita de notificaciones in-app — ver AGENTS.md §6.6. Muestra
 * respuestas del admin a denuncias y avisos de amonestación (ver
 * app/api/notifications/route.ts). Solo se monta con sesión activa — ver
 * AuthStatus.tsx.
 */
export function NotificationBell() {
  const t = useTranslations("Notifications");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications ?? []));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpen = async () => {
    setOpen((v) => !v);
    if (unreadCount === 0) return;
    // Marca todas las no leídas visibles como leídas al abrir — evita tener
    // que hacer clic una por una en un badge que ya cumplió su propósito de
    // avisar.
    const unread = notifications.filter((n) => !n.read);
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    await Promise.all(
      unread.map((n) => fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) })),
    );
  };

  if (notifications.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.bellButton} onClick={handleOpen} aria-label={t("toggleAria")}>
        🔔
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>
      {open && (
        <div className={styles.dropdown}>
          {notifications.length === 0 && <p className={styles.empty}>{t("empty")}</p>}
          {notifications.map((n) => (
            <div key={n.id} className={styles.entry}>
              <span className={styles.entryKind}>{KIND_EMOJI[n.kind]}</span>
              <div>
                <p className={styles.entryMessage}>{n.message}</p>
                <span className={styles.entryDate}>{new Date(n.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
