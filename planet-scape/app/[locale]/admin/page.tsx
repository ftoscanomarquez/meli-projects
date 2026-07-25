import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getGameConfig } from "@/lib/gameConfig";
import { getAdminViewRole } from "@/lib/actions/adminView";
import { AdminViewToggle } from "@/components/shared/AdminViewToggle";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import styles from "./page.module.css";

// /admin — ver AGENTS.md §9 (Fase 8). El rol se verifica aquí (Server
// Component) Y en cada Route Handler de /api/admin/* (ver lib/adminGuard.ts)
// — nunca solo en el cliente, ver AGENTS.md §3.1 punto 3.
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const t = await getTranslations("Admin");
  // Rol REAL en la base de datos — nunca se toca con el toggle de abajo.
  const isRealAdmin = session?.user?.role === "admin";
  // "Ver como jugador" (ver lib/actions/adminView.ts) — preferencia
  // puramente de vista, guardada en cookie. Solo decide qué se RENDERIZA en
  // esta página; la protección real de /api/admin/* (lib/adminGuard.ts)
  // sigue viendo siempre el rol real de arriba, nunca esta cookie.
  const viewRole = await getAdminViewRole();

  if (!isRealAdmin || viewRole === "player") {
    return (
      <div className={styles.gate}>
        {/* Un admin real viendo "como jugador" necesita poder volver a
            "Admin" sin salir de esta pantalla — un no-admin real (isRealAdmin
            false) nunca ve este selector, no tiene nada que alternar. */}
        {isRealAdmin && (
          <div className={styles.toggleWrap}>
            <AdminViewToggle initialRole={viewRole} />
          </div>
        )}
        <div className={styles.gateCard}>
          <h1 className={styles.gateTitle}>{t("unauthorizedTitle")}</h1>
          <p className={styles.gateBody}>{t("unauthorizedBody")}</p>
        </div>
      </div>
    );
  }

  const initialConfig = await getGameConfig();

  return (
    <>
      <div className={styles.toggleWrap}>
        <AdminViewToggle initialRole={viewRole} />
      </div>
      <AdminDashboard initialConfig={initialConfig} />
    </>
  );
}
