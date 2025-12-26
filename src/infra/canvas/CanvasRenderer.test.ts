import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JitterConfig } from "@/core/jitter";
import type { Drawing, Stroke } from "@/core/types";
import { CYCLE_COUNT } from "@/engine/renderingConstants";
import { CanvasRenderer } from "@/infra/canvas/CanvasRenderer";

function createTestCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  return canvas;
}

function createTestDrawing(strokes: Stroke[] = []): Drawing {
  return {
    width: 100,
    height: 100,
    strokes,
  };
}

function createTestStroke(
  id: string,
  points: Array<{ x: number; y: number; t: number }> = [{ x: 10, y: 10, t: 0 }],
): Stroke {
  return {
    id,
    kind: "draw",
    brush: {
      kind: "solid",
      color: { kind: "palette", index: 0 },
      width: 2,
      opacity: 1,
    },
    points,
  };
}

const defaultJitterConfig: JitterConfig = {
  amplitude: 1.0,
  frequency: 0.008,
};

describe("CanvasRenderer (cycle bitmap cache)", () => {
  let renderer: CanvasRenderer;
  let createImageBitmapCalls: string[];

  beforeEach(() => {
    createImageBitmapCalls = [];

    globalThis.createImageBitmap = vi.fn(
      async (source: ImageBitmapSource): Promise<ImageBitmap> => {
        if (source instanceof HTMLCanvasElement) {
          createImageBitmapCalls.push("canvas");
          return {
            width: source.width,
            height: source.height,
            close: () => {},
          } as ImageBitmap;
        }
        if (
          typeof source === "object" &&
          source !== null &&
          "width" in source &&
          "height" in source &&
          "close" in source
        ) {
          createImageBitmapCalls.push("bitmap");
          return {
            width: (source as ImageBitmap).width,
            height: (source as ImageBitmap).height,
            close: () => {},
          } as ImageBitmap;
        }
        throw new Error("Unsupported source type");
      },
    );

    const canvas = createTestCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    renderer = new CanvasRenderer({
      ctx,
      backgroundColor: "#ffffff",
      paletteColors: ["#000000"],
    });
  });

  test("初回描画でbitmapが生成される", async () => {
    const drawing = createTestDrawing([createTestStroke("s1")]);
    const bitmap = await renderer.getCycleBitmap({
      drawing,
      drawingRevision: 1,
      cycleIndex: 0,
      jitterConfig: defaultJitterConfig,
      elapsedTimeMs: 0,
    });

    expect(bitmap).toBeDefined();
    expect(createImageBitmapCalls).toContain("canvas");
  });

  test("同じkeyの再取得はcloneを返す", async () => {
    const drawing = createTestDrawing([createTestStroke("s1")]);
    const first = await renderer.getCycleBitmap({
      drawing,
      drawingRevision: 1,
      cycleIndex: 0,
      jitterConfig: defaultJitterConfig,
      elapsedTimeMs: 0,
    });
    const second = await renderer.getCycleBitmap({
      drawing,
      drawingRevision: 1,
      cycleIndex: 0,
      jitterConfig: defaultJitterConfig,
      elapsedTimeMs: 0,
    });

    expect(first).not.toBe(second);
    expect(createImageBitmapCalls).toContain("bitmap");
    const canvasCalls = createImageBitmapCalls.filter(
      (call) => call === "canvas",
    );
    expect(canvasCalls.length).toBe(1);
  });

  test("cycleIndexが範囲外の場合はエラーになる", async () => {
    const drawing = createTestDrawing([createTestStroke("s1")]);
    await expect(
      renderer.getCycleBitmap({
        drawing,
        drawingRevision: 1,
        cycleIndex: -1,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      }),
    ).rejects.toThrow();

    await expect(
      renderer.getCycleBitmap({
        drawing,
        drawingRevision: 1,
        cycleIndex: CYCLE_COUNT,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      }),
    ).rejects.toThrow();
  });

  test("invalidateRenderCacheでキャッシュが無効化される", async () => {
    const drawing = createTestDrawing([createTestStroke("s1")]);

    await renderer.getCycleBitmap({
      drawing,
      drawingRevision: 1,
      cycleIndex: 0,
      jitterConfig: defaultJitterConfig,
      elapsedTimeMs: 0,
    });

    renderer.invalidateRenderCache();

    await renderer.getCycleBitmap({
      drawing,
      drawingRevision: 1,
      cycleIndex: 0,
      jitterConfig: defaultJitterConfig,
      elapsedTimeMs: 0,
    });

    const canvasCalls = createImageBitmapCalls.filter(
      (call) => call === "canvas",
    );
    expect(canvasCalls.length).toBe(2);
  });
});
