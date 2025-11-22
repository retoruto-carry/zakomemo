import { getPatternDefinition, PATTERNS } from "./patterns";
import type { BrushPatternId } from "./types";

describe("patterns", () => {
  test("getPatternDefinition returns a known pattern", () => {
    const dots = getPatternDefinition("dots");
    expect(dots.id).toBe("dots");
    expect(dots.tile.alpha.length).toBe(dots.tile.width * dots.tile.height);
  });

  test("patterns include multiple variants", () => {
    const ids: BrushPatternId[] = [
      "dotsDense",
      "horizontal",
      "vertical",
      "checker",
    ];
    ids.forEach((id) => {
      const def = getPatternDefinition(id);
      expect(def.tile.alpha.length).toBe(def.tile.width * def.tile.height);
    });
  });

  test("getPatternDefinition throws on unknown id", () => {
    expect(() =>
      getPatternDefinition("unknown" as BrushPatternId),
    ).toThrowError();
  });

  test("PATTERNS includes at least one definition", () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(1);
  });
});
