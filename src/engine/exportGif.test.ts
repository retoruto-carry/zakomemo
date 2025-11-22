import type { Drawing, Stroke } from "../core/types";
import { exportDrawingAsGif } from "./exportGif";
import type { DrawingRenderer, GifEncoder } from "./ports";

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

  renderStroke(
    stroke: Stroke,
    _points: { x: number; y: number }[],
    timeMs: number,
  ): void {
    this.renders.push({ stroke, time: timeMs });
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
  begin(width: number, height: number, fps: number): void {
    this.beginArgs = { width, height, fps };
  }
  addFrame(imageData: ImageData): void {
    this.frames.push(imageData);
  }
  async finish(): Promise<Blob> {
    return new Blob(["gif"]);
  }
}

const drawing: Drawing = {
  width: 20,
  height: 20,
  strokes: [
    {
      id: "s1",
      kind: "draw",
      brush: { kind: "solid", color: "#000", width: 2, opacity: 1 },
      points: [
        { x: 0, y: 0, t: 0 },
        { x: 10, y: 0, t: 10 },
      ],
    },
  ],
};

describe("exportDrawingAsGif", () => {
  test("renders frames and collects them via GifEncoder", async () => {
    const renderer = new MockRenderer(drawing.width, drawing.height);
    const gif = new MockGifEncoder();

    const blob = await exportDrawingAsGif({
      drawing,
      renderer,
      gif,
      jitterConfig: { amplitude: 0, frequency: 1 },
      fps: 10,
      durationMs: 200,
    });

    expect(gif.beginArgs).toEqual({ width: 20, height: 20, fps: 10 });
    expect(gif.frames).toHaveLength(2);
    expect(blob).toBeInstanceOf(Blob);
  });
});
