import type { JitterConfig } from "../core/jitter";
import { computeJitter, computePatternJitter } from "../core/jitter";
import { snapToPixel } from "../core/pixelArt";
import type { Drawing, Stroke } from "../core/types";
import type { DrawingRenderer } from "./ports";

/**
 * フレーム数（固定）
 */
export const FRAME_COUNT = 3;

/**
 * ImageBitmapキャッシュ対応レンダラーの型ガード
 */
/**
 * フレームBitmap取得の引数
 */
export type GetFrameBitmapParams = {
  drawing: Drawing;
  frameIndex: number;
  jitterConfig: JitterConfig;
  elapsedTimeMs: number;
};

interface ImageBitmapCacheRenderer extends DrawingRenderer {
  getFrameBitmap(params: GetFrameBitmapParams): Promise<ImageBitmap>;
  getFrameCount(): number;
  flushFromBitmap(bitmap: ImageBitmap): void;
}

/**
 * レンダラーがImageBitmapキャッシュをサポートしているかチェック
 */
function isImageBitmapCacheRenderer(
  renderer: DrawingRenderer,
): renderer is ImageBitmapCacheRenderer {
  return (
    "getFrameBitmap" in renderer &&
    typeof renderer.getFrameBitmap === "function" &&
    "getFrameCount" in renderer &&
    typeof renderer.getFrameCount === "function" &&
    "flushFromBitmap" in renderer &&
    typeof renderer.flushFromBitmap === "function"
  );
}

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

/**
 * 描画を時間に応じてレンダリングする際の引数
 */
export type RenderDrawingAtTimeParams = {
  /** 描画データ */
  drawing: Drawing;
  /** 描画レンダラー */
  renderer: DrawingRenderer;
  /** jitter設定 */
  jitterConfig: JitterConfig;
  /** 経過時間（ミリ秒） */
  elapsedTimeMs: number;
};

/**
 * パターンブラシと通常ブラシで異なるジッター計算を使用して描画をレンダリング
 *
 * 3フレーム固定、ImageBitmapキャッシュを使用。
 * レンダラーがImageBitmapキャッシュをサポートしている場合は、
 * キャッシュから取得または生成したImageBitmapを使用して描画する。
 * サポートしていない場合、またはエラーが発生した場合は、
 * フォールバックとして通常の描画パスを使用する。
 *
 * @param params 描画パラメータ
 */
// 最新のフレームリクエストを追跡（競合状態を防ぐため）
let latestRequestId = 0;

export function renderDrawingAtTime(params: RenderDrawingAtTimeParams): void {
  const { drawing, renderer, jitterConfig, elapsedTimeMs } = params;
  // ImageBitmapキャッシュを使用する場合は、getFrameBitmapを使用
  if (isImageBitmapCacheRenderer(renderer)) {
    const frameCount = renderer.getFrameCount();
    // 3フレームを周期的に切り替える（jitterの周期を考慮）
    // フレーム間隔: 1秒 / (frequency * frameCount)
    const frameInterval = 1000 / (jitterConfig.frequency * frameCount);
    const currentFrameIndex = Math.floor(
      (elapsedTimeMs / frameInterval) % frameCount,
    );

    // リクエストIDをインクリメント（最新のリクエストを追跡）
    latestRequestId += 1;
    const requestId = latestRequestId;

    // 非同期でImageBitmapを取得して描画
    renderer
      .getFrameBitmap({
        drawing,
        frameIndex: currentFrameIndex,
        jitterConfig,
        elapsedTimeMs,
      })
      .then((bitmap: ImageBitmap) => {
        // このリクエストが最新でない場合は無視（競合状態を防ぐ）
        if (requestId !== latestRequestId) {
          bitmap.close(); // 使用しないImageBitmapは破棄
          return;
        }
        renderer.flushFromBitmap(bitmap);
      })
      .catch((err: unknown) => {
        // このリクエストが最新でない場合は無視
        if (requestId !== latestRequestId) {
          return;
        }
        console.error("Failed to get frame bitmap:", err);
        // フォールバック: 通常の描画
        renderDrawingAtTimeFallback({
          drawing,
          renderer,
          jitterConfig,
          elapsedTimeMs,
        });
      });
    return;
  }

  // フォールバック: 通常の描画（ImageBitmapキャッシュがない場合）
  renderDrawingAtTimeFallback({
    drawing,
    renderer,
    jitterConfig,
    elapsedTimeMs,
  });
}

/**
 * フォールバック: 通常の描画（ImageBitmapキャッシュがない場合）
 *
 * この関数は以下のケースで呼ばれる:
 * 1. ImageBitmapキャッシュをサポートしていないレンダラーの場合
 * 2. `getFrameBitmap`がエラーを返した場合
 *
 * 注意: この関数はImageBitmapキャッシュを更新しない。
 * `renderer.clear()`によりキャッシュは無効化されるが、
 * 新しいキャッシュは作成されない（通常の描画パスのため）。
 * 次回`getFrameBitmap`が呼ばれた際は、全ストロークから再生成される。
 *
 * @param params 描画パラメータ
 */
function renderDrawingAtTimeFallback(params: RenderDrawingAtTimeParams): void {
  const { drawing, renderer, jitterConfig, elapsedTimeMs } = params;
  renderer.clear(drawing.width, drawing.height);

  for (const stroke of drawing.strokes) {
    const jittered = applyJitterToStroke({
      stroke,
      elapsedTimeMs,
      jitterConfig,
    });
    renderer.renderStroke(stroke, jittered, elapsedTimeMs);
  }

  // ImageDataベースの実装では、フレームごとに1回描画
  if ("flush" in renderer && typeof renderer.flush === "function") {
    renderer.flush();
  }
}
