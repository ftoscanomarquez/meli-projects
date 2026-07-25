import { create } from "zustand";
import type { PlanetKey } from "../characterSvg";

/**
 * Estado de baja frecuencia para el HUD — ver AGENTS.md §3.1 / §12 regla 8.
 * NUNCA guarda posiciones/física por frame; esas viven dentro de GameEngine
 * (refs de PixiJS), fuera de React/Zustand por completo.
 */

export type AbilityPhase = "ready" | "active" | "cooldown";
export type BlackHolePhase = "hidden" | "warning" | "active" | "defeated";
// "dying" — secuencia de muerte (2026-07-22, ver AGENTS.md §5.1 y
// GameEngine.ts#runDeathSequence): pedido explícito del usuario, "para que
// no termine tan abrupto cuando te eliminan" — un par de segundos de
// animación (reacción de miedo/asombro, tinte rojo, cuarteaduras, vibración,
// explosión) ANTES de pasar a "gameover" de verdad. Durante "dying" el
// mundo del juego queda congelado (sin spawns/colisiones/movimiento) — ver
// GameEngine.ts#tick().
export type GameStatus = "playing" | "dying" | "gameover";
// Ver AGENTS.md §7 (Fase 6) — el guardado es asíncrono y puede fallar
// (sin sesión, sin red); el HUD debe reflejar el estado real, no asumir éxito.
export type SessionSaveStatus = "idle" | "saving" | "saved" | "error";

type GameState = {
  lives: number;
  // Estrellas ya acumuladas ANTES de esta partida (ver session.stars,
  // GlobalContext) — el HUD muestra `initialStars + starsThisRun` como
  // total en vivo, en vez de reiniciar la vista a 0 como si el jugador no
  // tuviera nada acumulado (bug real reportado por el usuario, 2026-07-22:
  // "debería aparecer 200 y tantas estrellas"). `starsThisRun` sigue siendo
  // el valor que se manda a /api/sessions/complete — no cambia ese contrato.
  initialStars: number;
  starsThisRun: number;
  // Guardado incremental cada 5 estrellas (2026-07-22, ver AGENTS.md §7.3):
  // cuántas de `starsThisRun` ya se le sumaron a `players.stars` en vivo
  // durante la partida (POST /api/sessions/star-increment). Al terminar la
  // partida, `/api/sessions/complete` solo acredita el RESTO
  // (`starsThisRun - starsCommitted`) para no contar dos veces las mismas
  // estrellas — así, si el juego se traba a mitad de partida, como mucho se
  // pierden las últimas <5 estrellas sin guardar, no todo el progreso.
  starsCommitted: number;
  level: number;
  gameStatus: GameStatus;
  abilityPhase: AbilityPhase;
  abilityProgress: number; // 0-1: fracción restante de la duración activa o del cooldown
  blackHolePhase: BlackHolePhase;
  blackHoleClicksRemaining: number;
  blackHoleClicksRequired: number;
  // `true` cuando el hazard "objetivo" es el Quasar (ver AGENTS.md §5.1),
  // no el agujero negro clásico/Nova — el HUD lo usa para mostrar una
  // alerta/botón distintos ("¡Derrota al Quasar!" en vez de "...al agujero
  // negro"), pedido implícito del usuario al pedir un fenómeno nuevo y
  // vistoso ("lo mas padre visualmente").
  blackHoleIsQuasar: boolean;
  sessionSaveStatus: SessionSaveStatus;
  // Preferencia de silencio de la música de fondo — ver engine/audio/backgroundMusic.ts.
  // No se resetea en `reset()` a propósito: es una preferencia del jugador
  // para la sesión del navegador, no parte del estado de una partida.
  musicMuted: boolean;
  // Frase épica de derrota, elegida al azar de `game_config.defeatPhrases`
  // (editable por admin) al terminar la secuencia de muerte — ver AGENTS.md
  // §5.1. Vacía mientras no ha muerto todavía.
  defeatPhrase: string;
  // Panel informativo de equipo (2026-07-23, ver AGENTS.md §8 y GameHud.tsx)
  // — pedido explícito del usuario: "de salir una opcion que aunque esten
  // jugando puedas ver las vidas y estrellas que tiene cada jugador como
  // informativo". Puramente de lectura — nunca afecta la física/colisiones
  // de nadie, solo lo que se muestra en el panel desplegable. Se llena vía
  // GameEngine.ts al recibir `playerStatus`/`abilityState` de cada
  // compañero (y al agregarlo/quitarlo del roster).
  teammates: Record<string, TeammateStatus>;
  // Marcador COMPARTIDO de agujeros negros derrotados entre TODO el equipo
  // (no por jugador) — pedido explícito del usuario: "es como el marcador
  // de cuantos agujeros negros hemos derrotado entre todos ese dato debe
  // ser el mismo en la partida". Se incrementa tanto al derrotar uno propio
  // como al recibir el aviso de que un compañero derrotó el suyo.
  blackHolesDefeatedTeam: number;
};

export type TeammateStatus = {
  displayName: string;
  planet: PlanetKey;
  lives: number;
  stars: number;
  abilityActive: boolean;
};

type GameActions = {
  setLives: (lives: number) => void;
  loseLife: (amount?: number) => void;
  addStars: (amount: number) => void;
  markStarsCommitted: (amount: number) => void;
  setLevel: (level: number) => void;
  setAbility: (phase: AbilityPhase, progress: number) => void;
  setBlackHole: (
    phase: BlackHolePhase,
    clicksRemaining?: number,
    clicksRequired?: number,
    isQuasar?: boolean,
  ) => void;
  setSessionSaveStatus: (status: SessionSaveStatus) => void;
  setMusicMuted: (muted: boolean) => void;
  // Llamada por GameEngine.ts al terminar la animación de muerte — recién
  // AQUÍ se pasa a "gameover" de verdad (ver comentario de GameStatus arriba).
  finishDeathSequence: (defeatPhrase: string) => void;
  // Panel informativo de equipo — ver comentario de `teammates` arriba.
  setTeammate: (id: string, patch: Partial<TeammateStatus>) => void;
  removeTeammate: (id: string) => void;
  setBlackHolesDefeatedTeam: (count: number) => void;
  reset: (initialStars?: number) => void;
};

const initialState: GameState = {
  lives: 10,
  initialStars: 0,
  starsThisRun: 0,
  starsCommitted: 0,
  level: 0,
  gameStatus: "playing",
  abilityPhase: "ready",
  abilityProgress: 0,
  blackHolePhase: "hidden",
  blackHoleClicksRemaining: 0,
  blackHoleClicksRequired: 3,
  blackHoleIsQuasar: false,
  sessionSaveStatus: "idle",
  musicMuted: false,
  defeatPhrase: "",
  teammates: {},
  blackHolesDefeatedTeam: 0,
};

export const useGameStore = create<GameState & GameActions>((set) => ({
  ...initialState,
  // Al llegar a 0 vidas, pasa a "dying" (NO "gameover" todavía) — ver
  // comentario de GameStatus arriba. GameEngine detecta esta transición
  // (antes/después de aplicar el golpe) y arranca la secuencia de muerte.
  // Nunca se fuerza de vuelta a "playing" aquí — `setLives` también se usa
  // para curar (pulsares, escudo de Júpiter), y no debe "revivir" de un
  // "dying"/"gameover" ya en curso solo porque llegó una curación tardía.
  setLives: (lives) => set((s) => ({ lives, gameStatus: lives <= 0 ? "dying" : s.gameStatus })),
  loseLife: (amount = 1) =>
    set((s) => {
      const lives = Math.max(0, s.lives - amount);
      return { lives, gameStatus: lives <= 0 ? "dying" : s.gameStatus };
    }),
  addStars: (amount) => set((s) => ({ starsThisRun: s.starsThisRun + amount })),
  // Se llama SOLO tras confirmar que el servidor ya sumó esas estrellas al
  // saldo real (ver GameEngine.ts#checkAndCommitStars) — nunca antes, para
  // no marcar como "a salvo" algo que en realidad falló por red/servidor.
  markStarsCommitted: (amount) => set((s) => ({ starsCommitted: s.starsCommitted + amount })),
  setLevel: (level) => set({ level }),
  setAbility: (abilityPhase, abilityProgress) => set({ abilityPhase, abilityProgress }),
  setBlackHole: (blackHolePhase, clicksRemaining, clicksRequired, isQuasar) =>
    set((s) => ({
      blackHolePhase,
      blackHoleClicksRemaining: clicksRemaining ?? s.blackHoleClicksRemaining,
      blackHoleClicksRequired: clicksRequired ?? s.blackHoleClicksRequired,
      blackHoleIsQuasar: isQuasar ?? false,
    })),
  setSessionSaveStatus: (sessionSaveStatus) => set({ sessionSaveStatus }),
  setMusicMuted: (musicMuted) => set({ musicMuted }),
  finishDeathSequence: (defeatPhrase) => set({ gameStatus: "gameover", defeatPhrase }),
  setTeammate: (id, patch) =>
    set((s) => ({
      teammates: {
        ...s.teammates,
        [id]: {
          displayName: s.teammates[id]?.displayName ?? "Jugador",
          planet: s.teammates[id]?.planet ?? "mercury",
          lives: s.teammates[id]?.lives ?? 10,
          stars: s.teammates[id]?.stars ?? 0,
          abilityActive: s.teammates[id]?.abilityActive ?? false,
          ...patch,
        },
      },
    })),
  removeTeammate: (id) =>
    set((s) => {
      const teammates = { ...s.teammates };
      delete teammates[id];
      return { teammates };
    }),
  setBlackHolesDefeatedTeam: (blackHolesDefeatedTeam) => set({ blackHolesDefeatedTeam }),
  // `musicMuted`/`teammates`/`blackHolesDefeatedTeam` no son parte del
  // estado de UNA partida — no se pisan al reiniciar (ver comentario en
  // GameState arriba, mismo criterio que `musicMuted`).
  reset: (initialStars = 0) =>
    set((s) => ({
      ...initialState,
      musicMuted: s.musicMuted,
      teammates: s.teammates,
      blackHolesDefeatedTeam: s.blackHolesDefeatedTeam,
      initialStars,
    })),
}));
