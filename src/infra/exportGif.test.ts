import type { Drawing, Stroke } from "@/core/types";
import type { DrawingRenderer, GifEncoder } from "@/engine/ports";
import { CYCLE_COUNT, CYCLE_INTERVAL_MS } from "@/engine/renderingConstants";
import { exportDrawingAsGif } from "@/infra/exportGif";

class MockRenderer implements DrawingRenderer {
  clears: { width: number; height: number }[] = [];
  renders: Array<{ stroke: Stroke; time: number }> = [];
  constructor(
    private width: number,
    private height: number,
  ) {}

  clear(width: number, height: number): void {
    this.clears.push({ width, height });
  }

  renderStroke({
    stroke,
    jitteredPoints: _jitteredPoints,
    elapsedTimeMs,
  }: {
    stroke: Stroke;
    jitteredPoints: { x: number; y: number }[];
    elapsedTimeMs: number;
  }): void {
    this.renders.push({ stroke, time: elapsedTimeMs });
  }

  invalidateRenderCache(): void {
    // モック用の空実装
  }

  getImageData(): ImageData {
    return {
      width: this.width,
      height: this.height,
      data: new Uint8ClampedArray(this.width * this.height * 4),
    } as unknown as ImageData;
  }
}

class MockGifEncoder implements GifEncoder {
  frames: ImageData[] = [];
  beginArgs: { width: number; height: number; fps: number } | null = null;
  backgroundColor: string | null = null;
  begin(width: number, height: number, fps: number): void {
    this.beginArgs = { width, height, fps };
  }
  addFrame(imageData: ImageData): void {
    this.frames.push(imageData);
  }
  setBackgroundColor(backgroundColor: string): void {
    this.backgroundColor = backgroundColor;
  }
  async finish(): Promise<Blob> {
    return new Blob(["gif"]);
  }
}

class MockCycleRenderer implements DrawingRenderer {
  revisions: number[] = [];
  closeSpy = vi.fn();
  constructor(
    private width: number,
    private height: number,
  ) {}

  clear(_width: number, _height: number): void {
    // モック用の空実装
  }

  renderStroke({
    stroke: _stroke,
    jitteredPoints: _jitteredPoints,
    elapsedTimeMs: _elapsedTimeMs,
  }: {
    stroke: Stroke;
    jitteredPoints: { x: number; y: number }[];
    elapsedTimeMs: number;
  }): void {
    // モック用の空実装
  }

  invalidateRenderCache(): void {
    // モック用の空実装
  }

  getCycleCount(): number {
    return CYCLE_COUNT;
  }

  async getCycleBitmap(params: {
    drawingRevision: number;
  }): Promise<ImageBitmap> {
    this.revisions.push(params.drawingRevision);
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const bitmap = canvas as unknown as ImageBitmap;
    (bitmap as { close: () => void }).close = this.closeSpy;
    return bitmap;
  }
}

const drawing: Drawing = {
  width: 20,
  height: 20,
  strokes: [
    {
      id: "s1",
      kind: "draw",
      brush: {
        kind: "solid",
        color: { kind: "palette", index: 0 },
        width: 2,
        opacity: 1,
      },
      points: [
        { x: 0, y: 0, t: 0 },
        { x: 10, y: 0, t: 10 },
      ],
    },
  ],
};

describe("exportDrawingAsGif", () => {
  test("フレームを描画しGifEncoderに渡す", async () => {
    const renderer = new MockRenderer(drawing.width, drawing.height);
    const gif = new MockGifEncoder();

    const blob = await exportDrawingAsGif({
      drawing,
      drawingRevision: 0,
      renderer,
      gif,
      jitterConfig: { amplitude: 0, frequency: 1 },
    });

    const fps = Math.round(1000 / CYCLE_INTERVAL_MS);
    expect(gif.beginArgs).toEqual({ width: 20, height: 20, fps });
    expect(gif.frames).toHaveLength(CYCLE_COUNT);
    expect(blob).toBeInstanceOf(Blob);
  });

  test("getCycleBitmapにdrawingRevisionが渡される", async () => {
    const renderer = new MockCycleRenderer(drawing.width, drawing.height);
    const gif = new MockGifEncoder();

    await exportDrawingAsGif({
      drawing,
      drawingRevision: 42,
      renderer,
      gif,
      jitterConfig: { amplitude: 0, frequency: 1 },
    });

    expect(renderer.revisions).toEqual([42, 42, 42]);
    expect(gif.frames).toHaveLength(CYCLE_COUNT);
    expect(renderer.closeSpy).toHaveBeenCalledTimes(CYCLE_COUNT);
  });
});
