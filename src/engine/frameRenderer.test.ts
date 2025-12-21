import type { Drawing, Stroke } from "../core/types";
import { renderDrawingAtTime } from "./frameRenderer";
import type { DrawingRenderer } from "./ports";

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

  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    elapsedTimeMs: number,
  ): void {
    this.strokes.push({
      stroke,
      jittered: jitteredPoints,
      time: elapsedTimeMs,
    });
  }

  clearPatternCache(): void {
    // noop for mock
  }
}

describe("renderDrawingAtTime", () => {
  test("clears canvas and renders each stroke with jitter", () => {
    const drawing: Drawing = {
      width: 200,
      height: 100,
      strokes: [
        {
          id: "s1",
          kind: "draw",
          brush: {
            kind: "solid",
            color: "#000",
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
    renderDrawingAtTime(
      drawing,
      renderer,
      { amplitude: 1, frequency: 0.01 },
      100,
    );

    expect(renderer.clears).toEqual([{ width: 200, height: 100 }]);
    expect(renderer.strokes).toHaveLength(1);
    const rendered = renderer.strokes[0];
    expect(rendered.jittered[0].x).not.toBe(drawing.strokes[0].points[0].x);
    expect(rendered.time).toBe(100);
  });
});
