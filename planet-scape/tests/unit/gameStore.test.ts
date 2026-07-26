import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/engine/store/gameStore";

// Store de Zustand fuera de React — se puede probar llamando getState()/las
// acciones directamente, sin renderizar nada. Ver AGENTS.md §11/§12 regla 8:
// este store NUNCA lleva física por frame, solo el HUD de baja frecuencia.
beforeEach(() => {
  useGameStore.getState().reset();
});

describe("useGameStore", () => {
  it("starts with 10 lives, level 0, and gameStatus playing", () => {
    const s = useGameStore.getState();
    expect(s.lives).toBe(10);
    expect(s.level).toBe(0);
    expect(s.gameStatus).toBe("playing");
  });

  it("loseLife decrements lives and never goes below 0", () => {
    useGameStore.getState().loseLife(3);
    expect(useGameStore.getState().lives).toBe(7);

    useGameStore.getState().loseLife(100);
    expect(useGameStore.getState().lives).toBe(0);
  });

  it("loseLife defaults to 1 life when no amount is given", () => {
    useGameStore.getState().loseLife();
    expect(useGameStore.getState().lives).toBe(9);
  });

  // "gameover" ya no se alcanza directo al perder la última vida — primero
  // pasa por "dying" (secuencia de muerte: reacciones faciales, cuarteaduras,
  // explosión, frase épica — ver AGENTS.md §5.3); solo `finishDeathSequence()`
  // marca "gameover" de verdad, al terminar esa animación.
  it("reaching 0 lives via loseLife flips gameStatus to dying (not gameover yet)", () => {
    useGameStore.getState().loseLife(10);
    expect(useGameStore.getState().lives).toBe(0);
    expect(useGameStore.getState().gameStatus).toBe("dying");
  });

  it("finishDeathSequence is the only path to gameover, and records the epic phrase", () => {
    useGameStore.getState().loseLife(10);
    expect(useGameStore.getState().gameStatus).toBe("dying");

    useGameStore.getState().finishDeathSequence("¡Volveré más brillante que nunca!");
    expect(useGameStore.getState().gameStatus).toBe("gameover");
    expect(useGameStore.getState().defeatPhrase).toBe("¡Volveré más brillante que nunca!");
  });

  it("setLives(0) flips gameStatus to dying; a later heal does NOT cancel the death sequence on its own", () => {
    useGameStore.getState().setLives(0);
    expect(useGameStore.getState().gameStatus).toBe("dying");

    // Una curación tardía no debe "resucitar" al jugador por sí sola — la
    // secuencia de muerte ya en curso solo termina vía finishDeathSequence().
    useGameStore.getState().setLives(5);
    expect(useGameStore.getState().gameStatus).toBe("dying");
  });

  it("addStars accumulates across calls", () => {
    useGameStore.getState().addStars(2);
    useGameStore.getState().addStars(3);
    expect(useGameStore.getState().starsThisRun).toBe(5);
  });

  it("setBlackHole updates phase and only overwrites clicks fields when provided", () => {
    useGameStore.getState().setBlackHole("active", 5, 5);
    useGameStore.getState().setBlackHole("defeated");

    const s = useGameStore.getState();
    expect(s.blackHolePhase).toBe("defeated");
    // clicksRemaining/clicksRequired no se pasaron en la 2ª llamada — deben conservarse.
    expect(s.blackHoleClicksRemaining).toBe(5);
    expect(s.blackHoleClicksRequired).toBe(5);
  });

  it("reset restores the full initial state after mutations", () => {
    useGameStore.getState().loseLife(9);
    useGameStore.getState().addStars(4);
    useGameStore.getState().setLevel(3);
    useGameStore.getState().setSessionSaveStatus("saved");

    useGameStore.getState().reset();

    const s = useGameStore.getState();
    expect(s.lives).toBe(10);
    expect(s.starsThisRun).toBe(0);
    expect(s.level).toBe(0);
    expect(s.sessionSaveStatus).toBe("idle");
    expect(s.gameStatus).toBe("playing");
  });
});
