import { describe, expect, it } from "vitest";
import { parseColorToRgb, resolveCssVariable } from "./colorUtil";

describe("colorUtil", () => {
  describe("resolveCssVariable", () => {
    it("should return the original color if it's not a CSS variable", () => {
      expect(resolveCssVariable("#ff0000")).toBe("#ff0000");
      expect(resolveCssVariable("red")).toBe("red");
    });

    it("should return the original color if window is undefined (SSR)", () => {
      // Vitest in this project seems to run in a Node-like env by default or doesn't have DOM here
      const originalWindow = global.window;
      (global as any).window = undefined;
      expect(resolveCssVariable("var(--test)")).toBe("var(--test)");
      global.window = originalWindow;
    });
  });

  describe("parseColorToRgb", () => {
    it("should parse 6-digit hex colors", () => {
      expect(parseColorToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseColorToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColorToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("should parse 3-digit hex colors", () => {
      expect(parseColorToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseColorToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColorToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("should return black for invalid colors", () => {
      expect(parseColorToRgb("invalid")).toEqual({ r: 0, g: 0, b: 0 });
    });
  });
});

