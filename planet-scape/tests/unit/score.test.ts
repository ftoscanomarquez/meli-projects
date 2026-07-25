import { describe, expect, it } from "vitest";
import { computeScore } from "@/lib/score";

describe("computeScore", () => {
  it("weighs level far more than stars (level*100 + stars)", () => {
    expect(computeScore(0, 0)).toBe(0);
    expect(computeScore(1, 0)).toBe(100);
    expect(computeScore(0, 5)).toBe(5);
    expect(computeScore(3, 7)).toBe(307);
  });

  it("a higher level always outscores more stars at a lower level", () => {
    // ver AGENTS.md §7.2 — el leaderboard premia sobrevivir/avanzar de nivel
    // por encima de acumular estrellas dentro del mismo nivel.
    expect(computeScore(2, 0)).toBeGreaterThan(computeScore(1, 99));
  });
});
