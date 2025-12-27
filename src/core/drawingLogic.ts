import type {
  BrushSettings,
  Drawing,
  Point,
  Stroke,
  StrokeKind,
} from "@/core/types";

/** ストロークを開始する */
export function startStroke(
  drawing: Drawing,
  strokeId: string,
  strokeKind: StrokeKind,
  brush: BrushSettings,
  startPoint: Point,
): Drawing {
  const newStroke: Stroke = {
    id: strokeId,
    kind: strokeKind,
    brush,
    points: [startPoint],
  };

  return {
    ...drawing,
    strokes: [...drawing.strokes, newStroke],
  };
}

/** 既存ストロークにポイントを追加する */
export function appendPoint(
  drawing: Drawing,
  strokeId: string,
  point: Point,
): Drawing {
  return {
    ...drawing,
    strokes: drawing.strokes.map((stroke) =>
      stroke.id === strokeId
        ? { ...stroke, points: [...stroke.points, point] }
        : stroke,
    ),
  };
}

/** 描画を全消去する */
export function clearDrawing(drawing: Drawing): Drawing {
  return {
    ...drawing,
    strokes: [],
  };
}
