import { getPatternDefinition, PATTERNS } from "./patterns";
import type { BrushPatternId } from "./types";

describe("patterns", () => {
  test("getPatternDefinitionは既知パターンを返す", () => {
    const dots = getPatternDefinition("dots");
    expect(dots.id).toBe("dots");
    expect(dots.tile.alpha.length).toBe(dots.tile.width * dots.tile.height);
  });

  test("patternsに複数のバリアントが含まれる", () => {
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

  test("未知のidではgetPatternDefinitionが例外を投げる", () => {
    expect(() =>
      getPatternDefinition("unknown" as BrushPatternId),
    ).toThrowError();
  });

  test("PATTERNSに最低1件の定義が含まれる", () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(1);
  });
});
