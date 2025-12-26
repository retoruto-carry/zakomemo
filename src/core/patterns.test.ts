import { getPatternDefinition, PATTERNS } from "./patterns";
import type { BrushPatternId } from "./types";

describe("patterns", () => {
  test("getPatternDefinitionは既知パターンを返す", () => {
    const dots = getPatternDefinition("dot_sparse");
    expect(dots.id).toBe("dot_sparse");
    expect(dots.tile.alpha.length).toBe(dots.tile.width * dots.tile.height);
    expect(dots.previewRepeatTime).toBeGreaterThan(0);
  });

  test("patternsに複数のバリアントが含まれる", () => {
    const ids: BrushPatternId[] = [
      "dot_dense",
      "stripe_horizontal",
      "stripe_vertical",
      "check",
      "mesh",
      "mesh_bold",
      "crosshatch",
    ];
    ids.forEach((id) => {
      const def = getPatternDefinition(id);
      expect(def.tile.alpha.length).toBe(def.tile.width * def.tile.height);
      expect(def.previewRepeatTime).toBeGreaterThan(0);
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
