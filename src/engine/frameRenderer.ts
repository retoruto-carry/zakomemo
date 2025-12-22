import type { JitterConfig } from "../core/jitter";
import { computeJitter, computePatternJitter } from "../core/jitter";
import { snapToPixel } from "../core/pixelArt";
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
    const isEraser = stroke.kind === "erase";
    const jittered = stroke.points.map((point) => {
      let jitteredPoint: { x: number; y: number };
      if (isEraser) {
        // 消しゴム: jitterを適用しない（元の座標をそのまま使用）
        jitteredPoint = { x: point.x, y: point.y };
      } else if (isPattern) {
        // パターン: 座標ベースのjitter（point.tを使わない）
        // 同じ座標には同じjitterが適用され、別ストロークでもずれない
        const jitter = computePatternJitter(point, elapsedTimeMs, jitterConfig);
        jitteredPoint = { x: point.x + jitter.dx, y: point.y + jitter.dy };
      } else {
        // ペン: 点ごとのjitter（point.tを使う）
        const jitter = computeJitter(point, elapsedTimeMs, jitterConfig);
        jitteredPoint = { x: point.x + jitter.dx, y: point.y + jitter.dy };
      }
      // ジッター適用後の座標を整数ピクセルにスナップ
      return snapToPixel(jitteredPoint.x, jitteredPoint.y);
    });
    renderer.renderStroke(stroke, jittered, elapsedTimeMs);
  }

  // ImageDataベースの実装では、フレームごとに1回描画
  if ("flush" in renderer && typeof renderer.flush === "function") {
    renderer.flush();
  }
}
