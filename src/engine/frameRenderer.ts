import type { JitterConfig, JitterOffset } from "../core/jitter";
import { computeJitter, computeGlobalJitter } from "../core/jitter";
import type { Drawing } from "../core/types";
import type { DrawingRenderer } from "./ports";

export function renderDrawingAtTime(
  drawing: Drawing,
  renderer: DrawingRenderer,
  jitterConfig: JitterConfig,
  timeMs: number,
): void {
  // パターン用のグローバルjitterを計算（全ストローク共通）
  const globalJitter = computeGlobalJitter(timeMs, jitterConfig);
  
  // Rendererにグローバルjitterを設定（パターンのsetTransformに使用）
  renderer.setPatternOffset?.(globalJitter);
  
  renderer.clear(drawing.width, drawing.height);

  for (const stroke of drawing.strokes) {
    // パターン描画時はグローバルjitterを使用（全ストローク共通でずれない）
    // それ以外は点ごとのjitterを使用
    const isPattern = stroke.brush.kind === "pattern";
    const jittered = stroke.points.map((point) => {
      if (isPattern) {
        return { x: point.x + globalJitter.dx, y: point.y + globalJitter.dy };
      }
      const jitter = computeJitter(point, timeMs, jitterConfig);
      return { x: point.x + jitter.dx, y: point.y + jitter.dy };
    });
    renderer.renderStroke(stroke, jittered, timeMs);
  }
}
