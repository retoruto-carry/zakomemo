import { describe, expect, test } from "vitest";
import type { Stroke } from "@/core/types";
import { ImageDataBuffer } from "@/infra/canvas/ImageDataBuffer";
import { renderStroke } from "@/infra/canvas/strokeRendering";

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

function createEraserStroke(
  variant: "eraserLine" | "eraserSquare",
  width: number,
): Stroke {
  return {
    id: "s-erase",
    kind: "erase",
    brush: {
      kind: "solid",
      color: "#000000",
      width,
      opacity: 1,
      variant,
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
      patternId: "dot_sparse",
    },
    points: [{ x: 1, y: 1, t: 0 }],
  };
}

describe("renderStroke", () => {
  test("ソリッドストロークがバッファに色を書き込む", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 4, height: 4 });

    const stroke = createSolidStroke("draw", "#ff0000");
    renderStroke({
      context: buffer,
      stroke,
      jitteredPoints: [{ x: 2, y: 2 }],
      elapsedTimeMs: 0,
    });

    expect(getPixel(buffer, 2, 2)).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 255,
    });
  });

  test("消しゴムストロークが背景色に戻す", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 4, height: 4 });

    const drawStroke = createSolidStroke("draw", "#ff0000");
    renderStroke({
      context: buffer,
      stroke: drawStroke,
      jitteredPoints: [{ x: 2, y: 2 }],
      elapsedTimeMs: 0,
    });

    const eraseStroke = createSolidStroke("erase", "#000000");
    renderStroke({
      context: buffer,
      stroke: eraseStroke,
      jitteredPoints: [{ x: 2, y: 2 }],
      elapsedTimeMs: 0,
    });

    expect(getPixel(buffer, 2, 2)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    });
  });

  test("消しゴムの線が移動中も形状を維持する", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 9, height: 9 });
    buffer.setPixel({ x: 8, y: 4, r: 0, g: 0, b: 0, a: 255 });

    const eraseStroke = createEraserStroke("eraserLine", 2);
    renderStroke({
      context: buffer,
      stroke: eraseStroke,
      jitteredPoints: [
        { x: 2, y: 4 },
        { x: 6, y: 4 },
      ],
      elapsedTimeMs: 0,
    });

    expect(getPixel(buffer, 8, 4)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    });
  });

  test("消しゴムの四角が移動中も形状を維持する", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 9, height: 9 });
    buffer.setPixel({ x: 6, y: 3, r: 0, g: 0, b: 0, a: 255 });

    const eraseStroke = createEraserStroke("eraserSquare", 3);
    renderStroke({
      context: buffer,
      stroke: eraseStroke,
      jitteredPoints: [
        { x: 2, y: 4 },
        { x: 6, y: 4 },
      ],
      elapsedTimeMs: 0,
    });

    expect(getPixel(buffer, 6, 3)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    });
  });

  test("パターンストロークがパターン色を書き込む", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 8, height: 8 });

    const stroke = createPatternStroke("#00ff00");
    renderStroke({
      context: buffer,
      stroke,
      jitteredPoints: [{ x: 1, y: 1 }],
      elapsedTimeMs: 0,
    });

    expect(getPixel(buffer, 1, 1)).toEqual({
      r: 0,
      g: 255,
      b: 0,
      a: 255,
    });
  });
});
