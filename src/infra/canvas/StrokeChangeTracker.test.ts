import { describe, expect, test } from "vitest";
import type { Drawing, Stroke } from "../../core/types";
import { StrokeChangeTracker } from "./StrokeChangeTracker";

function createStroke(
  id: string,
  points: Array<{ x: number; y: number; t: number }>,
): Stroke {
  return {
    id,
    kind: "draw",
    brush: {
      kind: "solid",
      color: "#000000",
      width: 2,
      opacity: 1,
    },
    points,
  };
}

function createDrawing(strokes: Stroke[]): Drawing {
  return {
    width: 100,
    height: 100,
    strokes,
  };
}

describe("StrokeChangeTracker", () => {
  test("未初期化の場合は全再生成扱いになる", () => {
    const tracker = new StrokeChangeTracker();
    const drawing = createDrawing([createStroke("s1", [{ x: 1, y: 1, t: 0 }])]);

    const diff = tracker.diff({ drawing });

    expect(diff.mode).toBe("scratch");
  });

  test("ポイント追加は差分として検出される", () => {
    const tracker = new StrokeChangeTracker();
    const initial = createDrawing([createStroke("s1", [{ x: 1, y: 1, t: 0 }])]);
    tracker.sync({ drawing: initial });

    const updated = createDrawing([
      createStroke("s1", [
        { x: 1, y: 1, t: 0 },
        { x: 2, y: 2, t: 16 },
      ]),
    ]);

    const diff = tracker.diff({ drawing: updated });

    expect(diff.mode).toBe("diff");
    if (diff.mode === "diff") {
      expect(diff.newStrokes).toHaveLength(0);
      expect(diff.strokesWithNewPoints).toHaveLength(1);
      expect(diff.strokesWithNewPoints[0].cachedPointCount).toBe(1);
    }
  });

  test("新しいストローク追加は差分として検出される", () => {
    const tracker = new StrokeChangeTracker();
    const initial = createDrawing([createStroke("s1", [{ x: 1, y: 1, t: 0 }])]);
    tracker.sync({ drawing: initial });

    const updated = createDrawing([
      createStroke("s1", [{ x: 1, y: 1, t: 0 }]),
      createStroke("s2", [{ x: 5, y: 5, t: 0 }]),
    ]);

    const diff = tracker.diff({ drawing: updated });

    expect(diff.mode).toBe("diff");
    if (diff.mode === "diff") {
      expect(diff.newStrokes).toHaveLength(1);
      expect(diff.newStrokes[0].id).toBe("s2");
      expect(diff.strokesWithNewPoints).toHaveLength(0);
    }
  });

  test("ストローク削除や順序変更は全再生成扱いになる", () => {
    const tracker = new StrokeChangeTracker();
    const initial = createDrawing([
      createStroke("s1", [{ x: 1, y: 1, t: 0 }]),
      createStroke("s2", [{ x: 2, y: 2, t: 0 }]),
    ]);
    tracker.sync({ drawing: initial });

    const reordered = createDrawing([
      createStroke("s2", [{ x: 2, y: 2, t: 0 }]),
      createStroke("s1", [{ x: 1, y: 1, t: 0 }]),
    ]);

    const diff = tracker.diff({ drawing: reordered });

    expect(diff.mode).toBe("scratch");
  });
});
