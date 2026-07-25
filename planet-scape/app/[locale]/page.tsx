import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { SpaceFactBubble } from "@/components/landing/SpaceFactBubble";
import { PlanetSelector } from "@/components/landing/PlanetSelector";
import { LeaderboardWidget } from "@/components/landing/LeaderboardWidget";
import { RoomLeaderboardWidget } from "@/components/landing/RoomLeaderboardWidget";
import { DonationBanner } from "@/components/landing/DonationBanner";
import { DonationButton } from "@/components/shared/DonationButton";
import { FeedbackButton } from "@/components/shared/FeedbackButton";
import { getSpaceFactText } from "@/lib/spaceFacts";
import { SPACE_FACT_HEADER } from "@/lib/spaceFacts.constants";
import { getGameConfig } from "@/lib/gameConfig";
import { getPlanetPlayCounts } from "@/lib/planetStats";
import { auth } from "@/lib/auth";
import { getAdminViewRole } from "@/lib/actions/adminView";
import styles from "./page.module.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Landing real (Fase 2) — diseño pasado por la skill `frontend-design`,
// ver AGENTS.md §1.1. El dato curioso se elige sin repetirse en proxy.ts
// y se lee directo de Mongo aquí (Server Component) — ver §5.3.
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ donation?: string }>;
}) {
  const { locale } = await params;
  const { donation } = await searchParams;
  setRequestLocale(locale);

  // Pedido explícito del usuario (2026-07-22): en modo Admin (rol real +
  // toggle "Ver como", ver AdminViewToggle.tsx) la landing normal (elegir
  // planeta para jugar) no tiene sentido — se manda directo a `/admin`, que
  // ya tiene la pantalla de configuración de todos los valores editables
  // (Sol, Agujero Negro, habilidades, donación, etc. — ver AGENTS.md §9).
  const session = await auth();
  if (session?.user?.role === "admin") {
    const viewRole = await getAdminViewRole();
    if (viewRole === "admin") {
      redirect(`/${locale}/admin`);
    }
  }

  const headerList = await headers();
  const factKeyRaw = headerList.get(SPACE_FACT_HEADER);
  const factKey = factKeyRaw !== null ? Number(factKeyRaw) : null;
  const factText =
    factKey !== null && !Number.isNaN(factKey)
      ? await getSpaceFactText(factKey, locale as AppLocale)
      : null;
  const gameConfig = await getGameConfig();
  const planetPlayCounts = await getPlanetPlayCounts();

  return (
    <main className={styles.page}>
      <AuthStatus />
      {(donation === "success" || donation === "cancelled") && (
        <DonationBanner locale={locale as AppLocale} status={donation} />
      )}
      <SpaceFactBubble locale={locale as AppLocale} factText={factText} />
      <PlanetSelector playCounts={planetPlayCounts} />
      {/* Top 10 individual a la izquierda, Top 10 de equipos a la derecha,
          en la misma fila — pedido explícito del usuario (2026-07-24): "que
          la informacion de top 10 individual este mas a la izquierda y el
          top 10 en equipo este mas a la derecha... solo en mobile dejalo
          que primero el top 10 individual y abajo el top 10 en equipo".
          `RoomLeaderboardWidget` no renderiza nada si no hay salas con
          récord todavía (ver su propio early return). */}
      <div className={styles.leaderboardsRow}>
        <LeaderboardWidget locale={locale as AppLocale} />
        <RoomLeaderboardWidget locale={locale as AppLocale} />
      </div>
      {/* Botón de donación siempre disponible, no solo al terminar una
          partida — pedido explícito del usuario (2026-07-22), ver AGENTS.md §10. */}
      <DonationButton donation={gameConfig.donation} whatsappLink={gameConfig.whatsappLink || undefined} floating />
      {/* Comentarios/sugerencias — pedido explícito del usuario (2026-07-22),
          ver AGENTS.md §2.3 y app/api/feedback/route.ts. */}
      <FeedbackButton />
    </main>
  );
}
