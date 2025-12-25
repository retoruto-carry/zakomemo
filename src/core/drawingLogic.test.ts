import { appendPoint, clearDrawing, startStroke } from "./drawingLogic";
import type { BrushSettings, Drawing } from "./types";

const baseDrawing: Drawing = {
  width: 100,
  height: 100,
  strokes: [],
};

const brush: BrushSettings = {
  kind: "solid",
  color: "#000000",
  width: 4,
  opacity: 1,
};

describe("drawingLogic", () => {
  test("startStrokeは初期ポイント付きのストロークを追加する", () => {
    const result = startStroke(baseDrawing, "s1", "draw", brush, {
      x: 10,
      y: 20,
      t: 0,
    });

    expect(result.strokes).toHaveLength(1);
    const stroke = result.strokes[0];
    expect(stroke.id).toBe("s1");
    expect(stroke.points).toEqual([{ x: 10, y: 20, t: 0 }]);
  });

  test("appendPointは指定ストロークにポイントを追加する", () => {
    const started = startStroke(baseDrawing, "s1", "draw", brush, {
      x: 1,
      y: 1,
      t: 0,
    });
    const updated = appendPoint(started, "s1", { x: 2, y: 3, t: 5 });

    expect(updated.strokes[0].points).toEqual([
      { x: 1, y: 1, t: 0 },
      { x: 2, y: 3, t: 5 },
    ]);
  });

  test("clearDrawingは全ストロークを削除する", () => {
    const started = startStroke(baseDrawing, "s1", "draw", brush, {
      x: 1,
      y: 1,
      t: 0,
    });
    const cleared = clearDrawing(started);

    expect(cleared.strokes).toHaveLength(0);
    expect(started.strokes).toHaveLength(1);
  });
});
