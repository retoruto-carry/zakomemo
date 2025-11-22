import { computeJitter } from "./jitter";
import type { Point } from "./types";

const point: Point = { x: 10, y: 20, t: 100 };

describe("computeJitter", () => {
  test("returns deterministic result for same inputs", () => {
    const config = { amplitude: 1.5, frequency: 0.01 };
    const a = computeJitter(point, 1000, config);
    const b = computeJitter(point, 1000, config);
    expect(a).toEqual(b);
  });

  test("amplitude 0 yields zero offsets", () => {
    const config = { amplitude: 0, frequency: 1 };
    const jitter = computeJitter(point, 500, config);
    expect(jitter.dx).toBeCloseTo(0);
    expect(jitter.dy).toBeCloseTo(0);
  });

  test("time affects jitter output when amplitude > 0", () => {
    const config = { amplitude: 2, frequency: 0.02 };
    const early = computeJitter(point, 0, config);
    const later = computeJitter(point, 500, config);
    expect(later.dx).not.toBeCloseTo(early.dx);
    expect(later.dy).not.toBeCloseTo(early.dy);
  });
});
