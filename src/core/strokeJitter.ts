import type { JitterConfig } from "@/core/jitter";
import { computeJitter, computePatternJitter } from "@/core/jitter";
import { snapToPixel } from "@/core/rasterization";
import type { Stroke } from "@/core/types";

/**
 * ストロークのポイントにjitterを適用する際の引数
 */
export type ApplyJitterToStrokeParams = {
  /** 対象のストローク */
  stroke: Stroke;
  /** 経過時間（ミリ秒） */
  elapsedTimeMs: number;
  /** jitter設定 */
  jitterConfig: JitterConfig;
};

/**
 * ストロークのポイントにjitterを適用して、整数ピクセルにスナップ
 *
 * 再利用可能な関数（差分描画でも使用）。
 * 消しゴムの場合はjitterを適用しない。
 *
 * @param params jitter適用のパラメータ
 * @returns jitter適用後の座標配列（整数ピクセルにスナップ済み）
 */
export function applyJitterToStroke(
  params: ApplyJitterToStrokeParams,
): Array<{ x: number; y: number }> {
  const { stroke, elapsedTimeMs, jitterConfig } = params;
  const isPattern = stroke.brush.kind === "pattern";
  const isEraser = stroke.kind === "erase";

  return stroke.points.map((point) => {
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
}
