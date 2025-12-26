import type { Drawing, Stroke } from "@/core/types";
import type { DrawingRenderer } from "@/engine/ports";
import {
  invalidatePendingRequests,
  renderDrawingAtTime,
} from "@/engine/renderScheduler";

class MockRenderer implements DrawingRenderer {
  clears: { width: number; height: number }[] = [];
  strokes: Array<{
    stroke: Stroke;
    jittered: { x: number; y: number }[];
    time: number;
  }> = [];

  clear(width: number, height: number): void {
    this.clears.push({ width, height });
  }

  renderStroke({
    stroke,
    jitteredPoints,
    elapsedTimeMs,
  }: {
    stroke: Stroke;
    jitteredPoints: { x: number; y: number }[];
    elapsedTimeMs: number;
  }): void {
    this.strokes.push({
      stroke,
      jittered: jitteredPoints,
      time: elapsedTimeMs,
    });
  }

  invalidateRenderCache(): void {
    // モック用の空実装
  }
}

type CycleRendererStub = DrawingRenderer & {
  getCycleBitmap: () => Promise<ImageBitmap>;
  getCycleCount: () => number;
  flushFromBitmap: (bitmap: ImageBitmap) => void;
  resolveBitmap: (bitmap: ImageBitmap) => void;
};

function createCycleRenderer(): CycleRendererStub {
  let resolver: ((bitmap: ImageBitmap) => void) | null = null;
  const getCycleBitmap = () =>
    new Promise<ImageBitmap>((resolve) => {
      resolver = resolve;
    });

  const renderer: CycleRendererStub = {
    clear: () => {},
    renderStroke: (_params) => {},
    invalidateRenderCache: () => {},
    getCycleCount: () => 1,
    getCycleBitmap,
    flushFromBitmap: () => {},
    resolveBitmap: (bitmap: ImageBitmap) => {
      if (!resolver) {
        throw new Error("resolver is not set");
      }
      resolver(bitmap);
    },
  };

  return renderer;
}

describe("renderDrawingAtTime", () => {
  test("キャンバスをクリアし各ストロークをジッター付きで描画する", () => {
    const drawing: Drawing = {
      width: 200,
      height: 100,
      strokes: [
        {
          id: "s1",
          kind: "draw",
          brush: {
            kind: "solid",
            color: { kind: "palette", index: 0 },
            width: 4,
            opacity: 1,
          },
          points: [
            { x: 0, y: 0, t: 0 },
            { x: 10, y: 0, t: 10 },
          ],
        },
      ],
    };

    const renderer = new MockRenderer();
    renderDrawingAtTime({
      drawing,
      drawingRevision: 0,
      renderer,
      jitterConfig: { amplitude: 1, frequency: 0.01 },
      elapsedTimeMs: 100,
    });

    expect(renderer.clears).toEqual([{ width: 200, height: 100 }]);
    expect(renderer.strokes).toHaveLength(1);
    const rendered = renderer.strokes[0];
    expect(rendered.jittered[0].x).not.toBe(drawing.strokes[0].points[0].x);
    expect(rendered.time).toBe(100);
  });

  test("ジッター適用後の座標は整数にスナップされる", () => {
    const drawing: Drawing = {
      width: 200,
      height: 100,
      strokes: [
        {
          id: "s1",
          kind: "draw",
          brush: {
            kind: "solid",
            color: { kind: "palette", index: 0 },
            width: 4,
            opacity: 1,
          },
          points: [
            { x: 0, y: 0, t: 0 },
            { x: 10, y: 10, t: 10 },
          ],
        },
      ],
    };

    const renderer = new MockRenderer();
    renderDrawingAtTime({
      drawing,
      drawingRevision: 0,
      renderer,
      jitterConfig: { amplitude: 1, frequency: 0.01 },
      elapsedTimeMs: 100,
    });

    const rendered = renderer.strokes[0];
    // すべてのジッター適用後の座標が整数であることを確認
    rendered.jittered.forEach((p) => {
      expect(Number.isInteger(p.x)).toBe(true);
      expect(Number.isInteger(p.y)).toBe(true);
    });
  });

  test("パターンストロークでも座標は整数にスナップされる", () => {
    const drawing: Drawing = {
      width: 200,
      height: 100,
      strokes: [
        {
          id: "s1",
          kind: "draw",
          brush: {
            kind: "pattern",
            color: { kind: "palette", index: 0 },
            width: 4,
            opacity: 1,
            patternId: "dot_sparse",
          },
          points: [
            { x: 0, y: 0, t: 0 },
            { x: 10, y: 10, t: 10 },
          ],
        },
      ],
    };

    const renderer = new MockRenderer();
    renderDrawingAtTime({
      drawing,
      drawingRevision: 0,
      renderer,
      jitterConfig: { amplitude: 1, frequency: 0.01 },
      elapsedTimeMs: 100,
    });

    const rendered = renderer.strokes[0];
    // すべてのジッター適用後の座標が整数であることを確認
    rendered.jittered.forEach((p) => {
      expect(Number.isInteger(p.x)).toBe(true);
      expect(Number.isInteger(p.y)).toBe(true);
    });
  });

  test("invalidatePendingRequestsで古い描画リクエストを破棄する", async () => {
    const drawing: Drawing = { width: 10, height: 10, strokes: [] };
    const renderer = createCycleRenderer();
    renderer.flushFromBitmap = vi.fn();
    const bitmap = { width: 1, height: 1, close: vi.fn() } as ImageBitmap;

    renderDrawingAtTime({
      drawing,
      drawingRevision: 1,
      renderer,
      jitterConfig: { amplitude: 0, frequency: 1 },
      elapsedTimeMs: 0,
    });

    invalidatePendingRequests(renderer);
    renderer.resolveBitmap(bitmap);
    await Promise.resolve();

    expect(renderer.flushFromBitmap).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalled();
  });

  test("レンダラー単位でリクエストIDが分離される", async () => {
    const drawing: Drawing = { width: 10, height: 10, strokes: [] };
    const rendererA = createCycleRenderer();
    const rendererB = createCycleRenderer();
    rendererA.flushFromBitmap = vi.fn();
    rendererB.flushFromBitmap = vi.fn();
    const bitmapA = { width: 1, height: 1, close: vi.fn() } as ImageBitmap;
    const bitmapB = { width: 1, height: 1, close: vi.fn() } as ImageBitmap;

    renderDrawingAtTime({
      drawing,
      drawingRevision: 1,
      renderer: rendererA,
      jitterConfig: { amplitude: 0, frequency: 1 },
      elapsedTimeMs: 0,
    });
    renderDrawingAtTime({
      drawing,
      drawingRevision: 1,
      renderer: rendererB,
      jitterConfig: { amplitude: 0, frequency: 1 },
      elapsedTimeMs: 0,
    });

    invalidatePendingRequests(rendererA);
    rendererB.resolveBitmap(bitmapB);
    rendererA.resolveBitmap(bitmapA);
    await Promise.resolve();

    expect(rendererA.flushFromBitmap).not.toHaveBeenCalled();
    expect(rendererB.flushFromBitmap).toHaveBeenCalledWith(bitmapB);
    expect(bitmapA.close).toHaveBeenCalled();
    expect(bitmapB.close).toHaveBeenCalled();
  });
});
