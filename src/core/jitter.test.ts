import { computeJitter } from "./jitter";
import type { Point } from "./types";

const point: Point = { x: 10, y: 20, t: 100 };

describe("computeJitter", () => {
  test("同じ入力で同じ結果を返す", () => {
    const config = { amplitude: 1.5, frequency: 0.01 };
    const a = computeJitter(point, 1000, config);
    const b = computeJitter(point, 1000, config);
    expect(a).toEqual(b);
  });

  test("amplitude=0ではオフセットが0になる", () => {
    const config = { amplitude: 0, frequency: 1 };
    const jitter = computeJitter(point, 500, config);
    expect(jitter.dx).toBeCloseTo(0);
    expect(jitter.dy).toBeCloseTo(0);
  });

  test("amplitude>0で時間によりジッターが変化する", () => {
    const config = { amplitude: 2, frequency: 0.02 };
    const early = computeJitter(point, 0, config);
    const later = computeJitter(point, 1000, config); // bucket should change
    expect(later.dx).not.toBe(early.dx);
    expect(later.dy).not.toBe(early.dy);
  });
});
