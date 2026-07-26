import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isPlanetKey } from "@/engine/characterSvg";
import { Lobby } from "@/components/lobby/Lobby";
import { getGameConfig } from "@/lib/gameConfig";
import { auth } from "@/lib/auth";
import { canPlayPlanet } from "@/lib/planetAccess";

// Fase 5 — ver AGENTS.md §2 y §8. Crea o une a una sala de PartyKit antes
// de arrancar la partida (mínimo 1, máximo 4 jugadores). Júpiter/Saturno
// requieren haberlos comprado con estrellas — ver lib/planetAccess.ts.
export default async function LobbyPage({
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

  return <Lobby planet={planet} gameConfig={gameConfig} />;
}
