import { wigglePatternTile } from "./patternDeform";
import type { PatternTile } from "./patternTypes";

const baseTile: PatternTile = {
  width: 2,
  height: 2,
  alpha: [0, 1, 2, 3],
};

describe("wigglePatternTile", () => {
  test("returns identical tile when amplitude is 0", () => {
    const result = wigglePatternTile(baseTile, 500, {
      amplitude: 0,
      frequency: 1,
    });
    expect(result).toEqual(baseTile);
    expect(result.alpha).not.toBe(baseTile.alpha);
  });

  test("re-maps alpha values deterministically with time and frequency", () => {
    const result = wigglePatternTile(baseTile, 100, {
      amplitude: 1,
      frequency: 0.5,
    });
    expect(result.alpha).toEqual([2, 3, 0, 1]);
  });
});
