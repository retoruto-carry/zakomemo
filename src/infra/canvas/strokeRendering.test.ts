import { describe, expect, test } from "vitest";
import type { Stroke } from "../../core/types";
import { ImageDataBuffer } from "./ImageDataBuffer";
import { renderStroke } from "./strokeRendering";

function createBuffer(backgroundColor: string): ImageDataBuffer {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D context is not available");
  }
  return new ImageDataBuffer({ ctx, backgroundColor });
}

function getPixel(
  buffer: ImageDataBuffer,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const data = buffer.getImageData().data;
  const { width } = buffer.getSize();
  const index = (y * width + x) * 4;
  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
    a: data[index + 3] ?? 0,
  };
}

function createSolidStroke(kind: "draw" | "erase", color: string): Stroke {
  return {
    id: "s1",
    kind,
    brush: {
      kind: "solid",
      color,
      width: 1,
      opacity: 1,
    },
    points: [{ x: 2, y: 2, t: 0 }],
  };
}

function createPatternStroke(color: string): Stroke {
  return {
    id: "s1",
    kind: "draw",
    brush: {
      kind: "pattern",
      color,
      width: 2,
      opacity: 1,
      patternId: "dots",
    },
    points: [{ x: 1, y: 1, t: 0 }],
  };
}

describe("renderStroke", () => {
  test("solid stroke writes color to the buffer", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 4, height: 4 });

    const stroke = createSolidStroke("draw", "#ff0000");
    renderStroke(buffer, stroke, [{ x: 2, y: 2 }], 0);

    expect(getPixel(buffer, 2, 2)).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 255,
    });
  });

  test("erase stroke restores the background color", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 4, height: 4 });

    const drawStroke = createSolidStroke("draw", "#ff0000");
    renderStroke(buffer, drawStroke, [{ x: 2, y: 2 }], 0);

    const eraseStroke = createSolidStroke("erase", "#000000");
    renderStroke(buffer, eraseStroke, [{ x: 2, y: 2 }], 0);

    expect(getPixel(buffer, 2, 2)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    });
  });

  test("pattern stroke writes the pattern color", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 8, height: 8 });

    const stroke = createPatternStroke("#00ff00");
    renderStroke(buffer, stroke, [{ x: 1, y: 1 }], 0);

    expect(getPixel(buffer, 1, 1)).toEqual({
      r: 0,
      g: 255,
      b: 0,
      a: 255,
    });
  });
});
