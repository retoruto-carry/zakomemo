import type { JitterConfig } from "../core/jitter";
import { computeJitter, computePatternJitter } from "../core/jitter";
import type { Drawing } from "../core/types";
import type { DrawingRenderer } from "./ports";

/**
 * パターンブラシと通常ブラシで異なるジッター計算を使用
 */
export function renderDrawingAtTime(
  drawing: Drawing,
  renderer: DrawingRenderer,
  jitterConfig: JitterConfig,
  elapsedTimeMs: number,
): void {
  renderer.clear(drawing.width, drawing.height);

  for (const stroke of drawing.strokes) {
    const isPattern = stroke.brush.kind === "pattern";
    const jittered = stroke.points.map((point) => {
      if (isPattern) {
        // パターン: 座標ベースのjitter（point.tを使わない）
        // 同じ座標には同じjitterが適用され、別ストロークでもずれない
        const jitter = computePatternJitter(point, elapsedTimeMs, jitterConfig);
        return { x: point.x + jitter.dx, y: point.y + jitter.dy };
      }
      // ペン/消しゴム: 点ごとのjitter（point.tを使う）
      const jitter = computeJitter(point, elapsedTimeMs, jitterConfig);
      return { x: point.x + jitter.dx, y: point.y + jitter.dy };
    });
    renderer.renderStroke(stroke, jittered, elapsedTimeMs);
  }
}
