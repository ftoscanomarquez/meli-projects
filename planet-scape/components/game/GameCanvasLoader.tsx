"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { PlanetKey } from "@/engine/characterSvg";
import type { MultiplayerConfig } from "@/engine/multiplayer/types";
import type { GameConfig } from "@/lib/schemas/gameConfig";

// Bundle pesado (WebGL): solo se carga en la ruta de partida — ver
// SPECIFICATION-SUMMARY.md §5.5 (`bundle-dynamic-imports`). `ssr:false` con
// `next/dynamic` requiere un Client Component; por eso este wrapper existe
// separado de la página (Server Component) — ver §5.1.
const GameCanvas = dynamic(() => import("./GameCanvas").then((m) => m.GameCanvas), {
  ssr: false,
  loading: () => <LoadingFallback />,
});

function LoadingFallback() {
  const t = useTranslations("Game");
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100dvh",
        color: "var(--ink-muted)",
        fontFamily: "var(--font-data)",
      }}
    >
      {t("loadingEngine")}
    </div>
  );
}

export function GameCanvasLoader({
  planet,
  multiplayerConfig,
  gameConfig,
}: {
  planet: PlanetKey;
  multiplayerConfig?: MultiplayerConfig;
  gameConfig?: GameConfig;
}) {
  return <GameCanvas planet={planet} multiplayerConfig={multiplayerConfig} gameConfig={gameConfig} />;
}
