"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { GameConfig } from "@/lib/schemas/gameConfig";
import { setAdminViewRole } from "@/lib/actions/adminView";
import { AdminConfigForm } from "./AdminConfigForm";
import { AdminPlayerSearch } from "./AdminPlayerSearch";
import { AdminFeedbackPanel } from "./AdminFeedbackPanel";
import { AdminReportsPanel } from "./AdminReportsPanel";
import { AdminChatPanel } from "./AdminChatPanel";
import { AdminChangeRequestsPanel } from "./AdminChangeRequestsPanel";
import styles from "./Admin.module.css";

type Tab = "config" | "players" | "feedback" | "reports" | "chat" | "changeRequests";

export function AdminDashboard({ initialConfig }: { initialConfig: GameConfig }) {
  const t = useTranslations("Admin");
  // Pestañas — pedido explícito del usuario (2026-07-22): "un botón que te
  // cambie de pestaña para administrar los comentarios" — antes Config y
  // Jugadores se mostraban ambos apilados; con Comentarios sumado, se
  // separan en pestañas para no volver la pantalla interminable.
  const [tab, setTab] = useState<Tab>("config");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        {/* Botón explícito de salida — pedido del usuario (2026-07-22):
            además del selector pequeño "Ver como" (arriba a la derecha,
            AdminViewToggle.tsx), este es inconfundible y hace lo mismo:
            vuelve a la landing normal como jugador. La redirección de vuelta
            a `/` ya la hace `app/[locale]/page.tsx` en cuanto la cookie deja
            de decir "admin" — ver AGENTS.md §9.4. */}
        <button
          type="button"
          className={styles.exitAdminButton}
          onClick={async () => {
            await setAdminViewRole("player");
            window.location.href = "/";
          }}
        >
          {t("exitAdminButton")}
        </button>
      </div>

      <div className={styles.tabBar}>
        <button type="button" className={styles.tabButton} data-active={tab === "config"} onClick={() => setTab("config")}>
          {t("tabConfig")}
        </button>
        <button type="button" className={styles.tabButton} data-active={tab === "players"} onClick={() => setTab("players")}>
          {t("tabPlayers")}
        </button>
        <button type="button" className={styles.tabButton} data-active={tab === "feedback"} onClick={() => setTab("feedback")}>
          {t("tabFeedback")}
        </button>
        <button type="button" className={styles.tabButton} data-active={tab === "reports"} onClick={() => setTab("reports")}>
          {t("tabReports")}
        </button>
        <button type="button" className={styles.tabButton} data-active={tab === "chat"} onClick={() => setTab("chat")}>
          {t("tabChat")}
        </button>
        <button
          type="button"
          className={styles.tabButton}
          data-active={tab === "changeRequests"}
          onClick={() => setTab("changeRequests")}
        >
          {t("tabChangeRequests")}
        </button>
      </div>

      {tab === "config" && <AdminConfigForm initialConfig={initialConfig} />}
      {tab === "players" && <AdminPlayerSearch />}
      {tab === "feedback" && <AdminFeedbackPanel />}
      {tab === "reports" && <AdminReportsPanel />}
      {tab === "chat" && <AdminChatPanel />}
      {tab === "changeRequests" && <AdminChangeRequestsPanel />}
    </div>
  );
}
