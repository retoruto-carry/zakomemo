import { describe, expect, test, vi } from "vitest";
import type { JitterConfig } from "../../core/jitter";
import type { Drawing, Stroke } from "../../core/types";
import { FrameBuilder } from "./FrameBuilder";
import type { ImageDataBuffer } from "./ImageDataBuffer";
import { renderStroke } from "./strokeRendering";

vi.mock("./strokeRendering", () => ({
  renderStroke: vi.fn(),
}));

describe("FrameBuilder", () => {
  test("差分描画では新規ポイントのみのストロークを渡す", async () => {
    const buffer = {
      loadFromBitmap: vi.fn(),
      createBitmap: vi.fn(async () => ({
        width: 1,
        height: 1,
        close: () => {},
      })),
    } as unknown as ImageDataBuffer;

    const frameBuilder = new FrameBuilder({ buffer });

    const stroke: Stroke = {
      id: "s1",
      kind: "draw",
      brush: {
        kind: "solid",
        color: "#000",
        width: 2,
        opacity: 1,
      },
      points: [
        { x: 0, y: 0, t: 0 },
        { x: 2, y: 0, t: 1 },
        { x: 4, y: 0, t: 2 },
      ],
    };

    const drawing: Drawing = {
      width: 10,
      height: 10,
      strokes: [stroke],
    };

    const jitterConfig: JitterConfig = { amplitude: 0, frequency: 1 };
    const baseBitmap = {
      width: 1,
      height: 1,
      close: () => {},
    } as ImageBitmap;

    await frameBuilder.buildWithDiff({
      drawing,
      cycleElapsedTimeMs: 0,
      jitterConfig,
      newStrokes: [],
      strokesWithNewPoints: [{ stroke, cachedPointCount: 2 }],
      baseBitmap,
    });

    const mockedRenderStroke = vi.mocked(renderStroke);
    expect(mockedRenderStroke).toHaveBeenCalledTimes(1);
    const [{ stroke: usedStroke, jitteredPoints }] =
      mockedRenderStroke.mock.calls[0];
    expect(usedStroke.points.length).toBe(jitteredPoints.length);
  });
});
