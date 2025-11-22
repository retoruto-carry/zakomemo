import { getPatternDefinition, PATTERNS } from "./patterns";

describe("patterns", () => {
  test("getPatternDefinition returns a known pattern", () => {
    const dots = getPatternDefinition("dots");
    expect(dots.id).toBe("dots");
    expect(dots.tile.alpha.length).toBe(dots.tile.width * dots.tile.height);
  });

  test("patterns include stripes and checker", () => {
    const stripes = getPatternDefinition("stripes");
    const checker = getPatternDefinition("checker");
    expect(stripes.tile.width * stripes.tile.height).toBe(stripes.tile.alpha.length);
    expect(checker.tile.alpha[0]).toBeDefined();
  });

  test("getPatternDefinition throws on unknown id", () => {
    expect(() => getPatternDefinition("unknown" as any)).toThrowError();
  });

  test("PATTERNS includes at least one definition", () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(1);
  });
});
