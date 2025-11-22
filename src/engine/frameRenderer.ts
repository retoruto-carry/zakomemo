import type { Drawing } from "../core/types";
import type { JitterConfig } from "../core/jitter";
import { computeJitter } from "../core/jitter";
import type { DrawingRenderer } from "./ports";

export function renderDrawingAtTime(
  drawing: Drawing,
  renderer: DrawingRenderer,
  jitterConfig: JitterConfig,
  timeMs: number
): void {
  renderer.clear(drawing.width, drawing.height);

  for (const stroke of drawing.strokes) {
    const jittered = stroke.points.map((point) => {
      const jitter = computeJitter(point, timeMs, jitterConfig);
      return { x: point.x + jitter.dx, y: point.y + jitter.dy };
    });
    renderer.renderStroke(stroke, jittered, timeMs);
  }
}
