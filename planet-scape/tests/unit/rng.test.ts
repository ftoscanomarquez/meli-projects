import { describe, expect, it } from "vitest";
import { createSeededRng, randomSeed } from "@/engine/rng";

describe("createSeededRng", () => {
  it("is deterministic: same seed produces the same sequence", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds produce different sequences", () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("always returns values in [0, 1)", () => {
    const rng = createSeededRng(123456);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("does not repeat the exact same value across consecutive calls (no obvious degeneracy)", () => {
    const rng = createSeededRng(7);
    const seen = new Set(Array.from({ length: 50 }, () => rng()));
    expect(seen.size).toBe(50);
  });
});

describe("randomSeed", () => {
  it("returns an integer within the 31-bit positive range", () => {
    for (let i = 0; i < 20; i++) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 31);
    }
  });
});
