import { describe, expect, it } from "vitest";
import { circlesOverlap, distance } from "@/engine/collision";

describe("distance", () => {
  it("computes euclidean distance between two points", () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
    expect(distance(-2, -2, -2, -2)).toBe(0);
  });
});

describe("circlesOverlap", () => {
  it("returns true when circles overlap", () => {
    expect(circlesOverlap(0, 0, 10, 15, 0, 10)).toBe(true);
  });

  it("returns false when circles are separate", () => {
    expect(circlesOverlap(0, 0, 10, 25, 0, 10)).toBe(false);
  });

  it("returns false for circles exactly touching (strict overlap only)", () => {
    // distance == r1 + r2 no cuenta como colisión (< estricto, no <=) —
    // ver engine/collision.ts, mismo comportamiento que el `Math.hypot(...) <`
    // original en GameEngine.checkCollisions().
    expect(circlesOverlap(0, 0, 10, 20, 0, 10)).toBe(false);
  });

  it("treats a zero-radius point as a circle (flare/black-hole-core checks)", () => {
    expect(circlesOverlap(5, 5, 0, 5, 5, 1)).toBe(true);
    expect(circlesOverlap(5, 5, 0, 100, 5, 1)).toBe(false);
  });
});
