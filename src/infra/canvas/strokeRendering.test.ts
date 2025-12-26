import { describe, expect, test } from "vitest";
import type { BrushColor, Stroke } from "@/core/types";
import { ImageDataBuffer } from "@/infra/canvas/ImageDataBuffer";
import { renderStroke } from "@/infra/canvas/strokeRendering";

/** テスト用のImageDataBufferを生成する */
function createBuffer(backgroundColor: string): ImageDataBuffer {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D context is not available");
  }
  return new ImageDataBuffer({ ctx, backgroundColor });
}

/** ImageDataBufferからピクセルを取得する */
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

/** ソリッドストロークを生成する */
function createSolidStroke(kind: "draw" | "erase", color: BrushColor): Stroke {
  return {
    id: "s1",
    kind,
    brush: {
      kind: "solid",
      color,
      width: 1,
      opacity: 1,
      variant: "normal",
    },
    points: [{ x: 2, y: 2, t: 0 }],
  };
}

/** 消しゴムストロークを生成する */
function createEraserStroke(
  variant: "eraserLine" | "eraserSquare",
  width: number,
): Stroke {
  return {
    id: "s-erase",
    kind: "erase",
    brush: {
      kind: "solid",
      color: { kind: "palette", index: 0 },
      width,
      opacity: 1,
      variant,
    },
    points: [{ x: 2, y: 2, t: 0 }],
  };
}

/** パターンストロークを生成する */
function createPatternStroke(color: BrushColor): Stroke {
  return {
    id: "s1",
    kind: "draw",
    brush: {
      kind: "pattern",
      color,
      width: 2,
      opacity: 1,
      patternId: "dot_sparse",
      variant: "normal",
    },
    points: [{ x: 1, y: 1, t: 0 }],
  };
}

describe("renderStroke", () => {
  test("ソリッドストロークがバッファに色を書き込む", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 4, height: 4 });
    const palette = ["#ff0000", "#00ff00", "#0000ff"];

    const stroke = createSolidStroke("draw", { kind: "palette", index: 0 });
    renderStroke({
      context: buffer,
      palette,
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
    const palette = ["#ff0000", "#00ff00", "#0000ff"];

    const drawStroke = createSolidStroke("draw", { kind: "palette", index: 0 });
    renderStroke({
      context: buffer,
      palette,
      stroke: drawStroke,
      jitteredPoints: [{ x: 2, y: 2 }],
      elapsedTimeMs: 0,
    });

    const eraseStroke = createSolidStroke("erase", {
      kind: "palette",
      index: 1,
    });
    renderStroke({
      context: buffer,
      palette,
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
    const palette = ["#ff0000", "#00ff00", "#0000ff"];

    const eraseStroke = createEraserStroke("eraserLine", 2);
    renderStroke({
      context: buffer,
      palette,
      stroke: eraseStroke,
      jitteredPoints: [
        { x: 2, y: 4 },
        { x: 6, y: 4 },
      ],
      elapsedTimeMs: 0,
    });

    // eraserLine(width=2)は中心から左右2px伸びるため、終点(6,4)の外側(8,4)も消える
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
    const palette = ["#ff0000", "#00ff00", "#0000ff"];

    const eraseStroke = createEraserStroke("eraserSquare", 3);
    renderStroke({
      context: buffer,
      palette,
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
    const palette = ["#ff0000", "#00ff00", "#0000ff"];

    const stroke = createPatternStroke({ kind: "palette", index: 1 });
    renderStroke({
      context: buffer,
      palette,
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
