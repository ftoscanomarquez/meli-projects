import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isPlanetKey } from "@/engine/characterSvg";
import { GameCanvasLoader } from "@/components/game/GameCanvasLoader";
import { getGameConfig } from "@/lib/gameConfig";
import { auth } from "@/lib/auth";
import { canPlayPlanet } from "@/lib/planetAccess";

// Fase 3 (single-player) — ver AGENTS.md §2. Balance leído de Mongo en cada
// partida nueva (Fase 8) — un cambio del admin aplica sin redeploy.
// Júpiter/Saturno requieren haberlos comprado con estrellas (ver
// lib/planetAccess.ts) — verificado aquí, no solo en la UI de selección.
export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ planet?: string }>;
}) {
  const { locale } = await params;
  const { planet } = await searchParams;
  setRequestLocale(locale);

  if (!isPlanetKey(planet)) {
    notFound();
  }

  const session = await auth();
  if (!canPlayPlanet(planet, !!session?.user, session?.user?.unlockedPlanets ?? [])) {
    notFound();
  }

  const gameConfig = await getGameConfig();

  return <GameCanvasLoader planet={planet} gameConfig={gameConfig} />;
}
