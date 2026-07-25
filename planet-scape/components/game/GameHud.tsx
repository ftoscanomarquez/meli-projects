"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useGameStore } from "@/engine/store/gameStore";
import { Link, useRouter } from "@/i18n/navigation";
import { useDraggablePanel } from "@/lib/hooks/useDraggablePanel";
import type { GameConfig } from "@/lib/schemas/gameConfig";
import type { PlanetKey } from "@/engine/characterSvg";
import { Mercury } from "@/components/characters/Mercury";
import { Venus } from "@/components/characters/Venus";
import { Earth } from "@/components/characters/Earth";
import { Mars } from "@/components/characters/Mars";
import { Jupiter } from "@/components/characters/Jupiter";
import { Saturn } from "@/components/characters/Saturn";
import { Neptune } from "@/components/characters/Neptune";
import { DonationPrompt } from "./DonationPrompt";
import { DonationButton } from "@/components/shared/DonationButton";
import styles from "./GameHud.module.css";

// Retrato del planeta en la pantalla de derrota — pedido explícito del
// usuario (2026-07-22, ver AGENTS.md §5.1): "le sale la pantalla de que ha
// sido derrotado con una carita triste de su planeta derrotado". Reutiliza
// el mismo componente SVG que ya existe para el carrusel de la landing (sin
// arte nuevo por planeta) — la "tristeza" la aporta la insignia 😢 encima,
// no un dibujo distinto por planeta.
const PLANET_CHARACTERS: Record<PlanetKey, (props: { size?: number }) => React.JSX.Element> = {
  mercury: Mercury,
  venus: Venus,
  earth: Earth,
  mars: Mars,
  jupiter: Jupiter,
  saturn: Saturn,
  neptune: Neptune,
};

export function GameHud({
  planet,
  isMultiplayer,
  onAbilityPress,
  onBlackHoleAttack,
  onToggleMusic,
  onExitConfirmed,
  gameConfig,
}: {
  planet: PlanetKey;
  isMultiplayer: boolean;
  onAbilityPress: () => void;
  onBlackHoleAttack: () => void;
  onToggleMusic: () => void;
  // Pedido explícito del usuario (2026-07-23): "en el top 5 de equipos
  // deben salir los planetas del equipo completo" — salir manualmente antes
  // de morir debe reportar el resultado igual que un game over real, ver
  // GameEngine.ts#reportManualExit().
  onExitConfirmed: () => void;
  gameConfig: GameConfig;
}) {
  const t = useTranslations("Game");
  const router = useRouter();
  const [confirmingExit, setConfirmingExit] = useState(false);
  // Panel desplegable de vidas/estrellas del equipo — pedido explícito del
  // usuario (2026-07-23, ver AGENTS.md §8): "de salir una opcion que aunque
  // esten jugando puedas ver las vidas y estrellas que tiene cada jugador
  // como informativo... solo cuando estas en modo sala o partida".
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const teamPanelRef = useRef<HTMLDivElement>(null);
  // Ventana movible y translúcida — pedido explícito del usuario
  // (2026-07-23): "lo mismo con la ventana informatica de vida y numero de
  // estrellas que sea tambien traslucida y que se pueda mover la ventana de
  // lugar si es necesario".
  const { style: teamPanelDragStyle, dragging: teamPanelDragging, handleProps: teamPanelHandleProps } =
    useDraggablePanel(teamPanelRef);
  const lives = useGameStore((s) => s.lives);
  const initialStars = useGameStore((s) => s.initialStars);
  const starsThisRun = useGameStore((s) => s.starsThisRun);
  const level = useGameStore((s) => s.level);
  const abilityPhase = useGameStore((s) => s.abilityPhase);
  const blackHolePhase = useGameStore((s) => s.blackHolePhase);
  const blackHoleClicksRemaining = useGameStore((s) => s.blackHoleClicksRemaining);
  // `true` cuando el hazard objetivo es el Quasar (ver AGENTS.md §5.1) — el
  // HUD muestra una alerta/botón distintos, más vistosos, en vez de
  // reutilizar el texto/emoji del agujero negro clásico.
  const blackHoleIsQuasar = useGameStore((s) => s.blackHoleIsQuasar);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const sessionSaveStatus = useGameStore((s) => s.sessionSaveStatus);
  const musicMuted = useGameStore((s) => s.musicMuted);
  // Frase épica de derrota, elegida al azar al terminar la secuencia de
  // muerte — ver AGENTS.md §5.1 y engine/GameEngine.ts#updateDeathSequence.
  const defeatPhrase = useGameStore((s) => s.defeatPhrase);
  // Marcador/panel de equipo — ver AGENTS.md §8. Puramente informativo.
  const teammates = useGameStore((s) => s.teammates);
  const blackHolesDefeatedTeam = useGameStore((s) => s.blackHolesDefeatedTeam);
  const PlanetCharacter = PLANET_CHARACTERS[planet];

  // Botón del agujero negro en móvil: mantenerlo presionado debe golpear
  // repetidamente, igual que mantener presionada la Spacebar en PC (el
  // teclado repite `keydown` de forma nativa mientras se mantiene, ver
  // GameCanvas.tsx#onKeyDown, sin filtrar `e.repeat`) — pedido explícito del
  // usuario (2026-07-24): "que si lo dejas oprimido es como si le dieras
  // mas clics solitos y vencen mas rapido al agujero negro". Un solo golpe
  // inmediato al presionar (para que un toque rápido se sienta igual que
  // antes) y, tras un breve retraso, golpes repetidos mientras se sostiene.
  const blackHoleHoldRef = useRef<{
    timeout: ReturnType<typeof setTimeout> | null;
    interval: ReturnType<typeof setInterval> | null;
  }>({ timeout: null, interval: null });

  const stopBlackHoleHold = () => {
    const hold = blackHoleHoldRef.current;
    if (hold.timeout) clearTimeout(hold.timeout);
    if (hold.interval) clearInterval(hold.interval);
    hold.timeout = null;
    hold.interval = null;
  };

  const startBlackHoleHold = () => {
    stopBlackHoleHold();
    onBlackHoleAttack();
    blackHoleHoldRef.current.timeout = setTimeout(() => {
      blackHoleHoldRef.current.interval = setInterval(onBlackHoleAttack, 70);
    }, 350);
  };

  // El botón desaparece del DOM en cuanto el agujero negro deja de estar
  // activo (ver `blackHolePhase === "active"` más abajo) — si eso pasa
  // mientras se mantiene presionado, ningún `pointerup` llega a dispararse
  // sobre un elemento ya desmontado. Este efecto es la red de seguridad que
  // detiene el intervalo en ese caso (y al desmontar el HUD).
  useEffect(() => {
    if (blackHolePhase !== "active") stopBlackHoleHold();
    return stopBlackHoleHold;
  }, [blackHolePhase]);

  return (
    <>
      <div className={styles.topBar}>
        <span className={`${styles.stat} ${styles.lives}`}>♥ {lives}</span>
        <span className={`${styles.stat} ${styles.levelBadge}`}>
          {t("level")} {level}
        </span>
        <span className={`${styles.stat} ${styles.starCount}`}>⭐ {initialStars + starsThisRun}</span>
        {isMultiplayer && (
          <span className={`${styles.stat} ${styles.teamProgress}`} title={t("blackHolesTeamLabel")}>
            🕳️ {blackHolesDefeatedTeam}
          </span>
        )}
        {isMultiplayer && (
          <button
            type="button"
            className={styles.musicButton}
            aria-label={t("teamPanelToggleAria")}
            onClick={() => setTeamPanelOpen((v) => !v)}
          >
            👥
          </button>
        )}
        <button
          type="button"
          className={styles.musicButton}
          aria-label={musicMuted ? t("unmuteMusic") : t("muteMusic")}
          onClick={onToggleMusic}
        >
          {musicMuted ? "🔇" : "🔊"}
        </button>
        {gameStatus === "playing" && (
          <>
            {/* Botón de donación SIEMPRE disponible mientras se juega, no
                solo en la pantalla de fin de partida — pedido explícito del
                usuario (2026-07-22): "que no solo esté cuando te matan". */}
            <DonationButton donation={gameConfig.donation} whatsappLink={gameConfig.whatsappLink || undefined} />
            <button
              type="button"
              className={styles.exitButton}
              aria-label={t("exitGame")}
              onClick={() => setConfirmingExit(true)}
            >
              ✕
            </button>
          </>
        )}
      </div>

      {isMultiplayer && teamPanelOpen && (
        <div className={styles.teamPanel} ref={teamPanelRef} style={teamPanelDragStyle}>
          <div className={styles.teamPanelHeader} data-dragging={teamPanelDragging} {...teamPanelHandleProps}>
            <span>{t("teamPanelTitle")}</span>
            <button
              type="button"
              className={styles.closeTeamPanel}
              onClick={() => setTeamPanelOpen(false)}
              aria-label={t("exitConfirmNo")}
            >
              ✕
            </button>
          </div>
          <div className={styles.teamPanelRow}>
            <PlanetCharacter size={28} />
            <span className={styles.teamPanelName}>{t("teamPanelYou")}</span>
            <span className={styles.teamPanelStat}>♥ {lives}</span>
            <span className={styles.teamPanelStat}>⭐ {initialStars + starsThisRun}</span>
          </div>
          {Object.entries(teammates).map(([id, mate]) => {
            const MateCharacter = PLANET_CHARACTERS[mate.planet];
            return (
              <div key={id} className={styles.teamPanelRow} data-active={mate.abilityActive}>
                <MateCharacter size={28} />
                <span className={styles.teamPanelName}>{mate.displayName}</span>
                <span className={styles.teamPanelStat}>♥ {mate.lives}</span>
                <span className={styles.teamPanelStat}>⭐ {mate.stars}</span>
              </div>
            );
          })}
        </div>
      )}

      {confirmingExit && (
        <div className={styles.exitConfirmOverlay} role="dialog" aria-modal="true">
          <div className={styles.exitConfirmCard}>
            <p className={styles.exitConfirmText}>{t("exitConfirmBody")}</p>
            <div className={styles.exitConfirmActions}>
              <button type="button" className={styles.exitConfirmNo} onClick={() => setConfirmingExit(false)}>
                {t("exitConfirmNo")}
              </button>
              <button
                type="button"
                className={styles.exitConfirmYes}
                onClick={() => {
                  onExitConfirmed();
                  router.push("/");
                }}
              >
                {t("exitConfirmYes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {gameStatus === "playing" && blackHolePhase === "active" && (
        <p className={styles.blackHoleAlert} data-quasar={blackHoleIsQuasar}>
          {blackHoleIsQuasar ? t("quasarAlert") : t("blackHoleAlert")} {blackHoleClicksRemaining}
        </p>
      )}

      {/* Ocultos durante "dying" (ver AGENTS.md §5.1) — la secuencia de
          muerte congela el juego, no tiene caso mostrar controles inertes
          mientras se reproduce. */}
      {gameStatus === "playing" && (
        <button
          type="button"
          className={styles.abilityButton}
          data-phase={abilityPhase}
          aria-label={t("abilityButtonLabel")}
          onClick={onAbilityPress}
          onContextMenu={(e) => e.preventDefault()}
        >
          ✦
        </button>
      )}

      {/* Botón distinto al de habilidad — antes compartían el mismo botón y
          se confundía en móvil, ver AGENTS.md §5.1 y feedback real del
          usuario (2026-07-22). Solo aparece mientras el agujero negro está
          activo, del lado opuesto de la pantalla. */}
      {gameStatus === "playing" && blackHolePhase === "active" && (
        <button
          type="button"
          className={styles.blackHoleButton}
          data-quasar={blackHoleIsQuasar}
          aria-label={blackHoleIsQuasar ? t("quasarButtonLabel") : t("blackHoleButtonLabel")}
          onPointerDown={startBlackHoleHold}
          onPointerUp={stopBlackHoleHold}
          onPointerLeave={stopBlackHoleHold}
          onPointerCancel={stopBlackHoleHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          {blackHoleIsQuasar ? "🌌" : "💥"}
        </button>
      )}

      {gameStatus === "gameover" && (
        <div className={styles.gameOverOverlay}>
          <div className={styles.gameOverContent}>
            {/* Pedido explícito del usuario (2026-07-24): "cuando a alguien
                se muere el modal que abre el boton de Donacion esta abajo y
                es lo primero que debe de salir y resaltar" — antes era lo
                ÚLTIMO de la pantalla de fin de partida, ahora es lo primero. */}
            <DonationPrompt donation={gameConfig.donation} whatsappLink={gameConfig.whatsappLink || undefined} />
            {/* Carita triste del propio planeta derrotado — pedido explícito
                del usuario, ver AGENTS.md §5.1. */}
            <div className={styles.defeatedPortrait}>
              <PlanetCharacter size={110} />
              <span className={styles.sadBadge}>😢</span>
            </div>
            <h2 className={styles.gameOverTitle}>{t("gameOverTitle")}</h2>
            {defeatPhrase && <p className={styles.defeatPhrase}>&ldquo;{defeatPhrase}&rdquo;</p>}
            <p className={styles.gameOverBody}>{t("gameOverBody", { level, stars: starsThisRun })}</p>
            <p className={styles.saveStatus} data-status={sessionSaveStatus}>
              {sessionSaveStatus === "saving" && t("saveStatusSaving")}
              {sessionSaveStatus === "saved" && t("saveStatusSaved")}
              {sessionSaveStatus === "error" && t("saveStatusError")}
            </p>
            <Link href="/" className={styles.backLink}>
              {t("backToMenu")}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
