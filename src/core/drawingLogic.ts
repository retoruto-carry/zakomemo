import type {
  BrushSettings,
  Drawing,
  Point,
  Stroke,
  StrokeKind,
} from "./types";

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

export function clearDrawing(drawing: Drawing): Drawing {
  return {
    ...drawing,
    strokes: [],
  };
}
