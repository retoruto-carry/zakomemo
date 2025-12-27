import type { JitterConfig } from "@/core/jitter";
import { applyJitterToStroke } from "@/core/strokeJitter";
import type { Drawing } from "@/core/types";
import type { DrawingRenderer, GetCycleBitmapParams } from "@/engine/ports";
import { CYCLE_INTERVAL_MS } from "@/engine/renderingConstants";

interface CycleBitmapRenderer extends DrawingRenderer {
  /** 取得したImageBitmapのcloseは呼び出し側が行う */
  getCycleBitmap(params: GetCycleBitmapParams): Promise<ImageBitmap>;
  getCycleCount(): number;
  flushFromBitmap(bitmap: ImageBitmap): void;
}

/**
 * レンダラーがImageBitmapキャッシュをサポートしているか判定する
 */
function isCycleBitmapRenderer(
  renderer: DrawingRenderer,
): renderer is CycleBitmapRenderer {
  return (
    "getCycleBitmap" in renderer &&
    typeof renderer.getCycleBitmap === "function" &&
    "getCycleCount" in renderer &&
    typeof renderer.getCycleCount === "function" &&
    "flushFromBitmap" in renderer &&
    typeof renderer.flushFromBitmap === "function"
  );
}

/**
 * 描画を時間に応じてレンダリングする際の引数
 */
export type RenderDrawingAtTimeParams = {
  /** 描画データ */
  drawing: Drawing;
  /** Drawingの版番号 */
  drawingRevision: number;
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
 * 3cycle固定、ImageBitmapキャッシュを使用。
 * レンダラーがImageBitmapキャッシュをサポートしている場合は、
 * キャッシュから取得または生成したImageBitmapを使用して描画する。
 * サポートしていない場合、またはエラーが発生した場合は、
 * フォールバックとして通常の描画パスを使用する。
 *
 * @param params 描画パラメータ
 */
// 最新のフレームリクエストをレンダラーごとに追跡（競合状態を防ぐため）
const rendererRequestIds = new WeakMap<DrawingRenderer, number>();

function getLatestRequestId(renderer: DrawingRenderer): number {
  return rendererRequestIds.get(renderer) ?? 0;
}

function bumpRequestId(renderer: DrawingRenderer): number {
  const nextId = getLatestRequestId(renderer) + 1;
  rendererRequestIds.set(renderer, nextId);
  return nextId;
}

function isLatestRequest({
  renderer,
  requestId,
}: {
  renderer: DrawingRenderer;
  requestId: number;
}): boolean {
  return getLatestRequestId(renderer) === requestId;
}

/**
 * 保留中の非同期レンダリングリクエストを無効化
 * キャッシュが無効化された際に、古いリクエストが閉じられたImageBitmapを使用しないようにする
 */
export function invalidatePendingRequests(renderer: DrawingRenderer): void {
  bumpRequestId(renderer);
}

/**
 * レンダラーのキャッシュ無効化と保留中リクエスト破棄をまとめて行う
 */
export function invalidateRendererCache(renderer: DrawingRenderer): void {
  renderer.invalidateRenderCache();
  bumpRequestId(renderer);
}

/**
 * 指定時刻のDrawingをレンダリングする。
 * ImageBitmapキャッシュ対応の場合は非同期で取得し、最新リクエストのみ描画する。
 */
export function renderDrawingAtTime(params: RenderDrawingAtTimeParams): void {
  const { drawing, drawingRevision, renderer, jitterConfig, elapsedTimeMs } =
    params;
  // ImageBitmapキャッシュを使用する場合は、getCycleBitmapを使用
  if (isCycleBitmapRenderer(renderer)) {
    const cycleCount = renderer.getCycleCount();
    // cycleCount分を周期的に切り替える
    // アニメーション速度: 10fps（100ms/フレーム）で固定
    // cycleCount分で1サイクルになる
    const currentCycleIndex = Math.floor(
      (elapsedTimeMs / CYCLE_INTERVAL_MS) % cycleCount,
    );

    // リクエストIDを更新（最新のリクエストを追跡）
    const requestId = bumpRequestId(renderer);

    // 非同期でImageBitmapを取得して描画
    renderer
      .getCycleBitmap({
        drawing,
        drawingRevision,
        cycleIndex: currentCycleIndex,
        jitterConfig,
        elapsedTimeMs,
      })
      .then((bitmap: ImageBitmap) => {
        // このリクエストが最新でない場合は無視（競合状態を防ぐ）
        if (!isLatestRequest({ renderer, requestId })) {
          bitmap.close(); // 使用しないImageBitmapは破棄
          return;
        }
        try {
          renderer.flushFromBitmap(bitmap);
        } catch (err) {
          // ImageBitmapが無効な場合（例: 既にclose()されている）
          console.error("Failed to flush bitmap (detached):", err);
          // キャッシュを無効化して再生成を試みる
          if (
            "invalidateRenderCache" in renderer &&
            typeof renderer.invalidateRenderCache === "function"
          ) {
            renderer.invalidateRenderCache();
          }
          // 再生成を試みる（キャッシュが無効化されているため、次回getCycleBitmapで再生成される）
          renderer
            .getCycleBitmap({
              drawing,
              drawingRevision,
              cycleIndex: currentCycleIndex,
              jitterConfig,
              elapsedTimeMs,
            })
            .then((newBitmap: ImageBitmap) => {
              // このリクエストが最新でない場合は無視
              if (!isLatestRequest({ renderer, requestId })) {
                newBitmap.close();
                return;
              }
              try {
                renderer.flushFromBitmap(newBitmap);
              } catch (retryErr) {
                console.error("Failed to flush bitmap after retry:", retryErr);
                // 最終的なフォールバック
                renderDrawingAtTimeFallback({
                  drawing,
                  drawingRevision,
                  renderer,
                  jitterConfig,
                  elapsedTimeMs,
                });
              } finally {
                newBitmap.close();
              }
            })
            .catch((retryErr: unknown) => {
              if (!isLatestRequest({ renderer, requestId })) {
                return;
              }
              console.error(
                "Failed to get cycle bitmap after retry:",
                retryErr,
              );
              // 最終的なフォールバック
              renderDrawingAtTimeFallback({
                drawing,
                drawingRevision,
                renderer,
                jitterConfig,
                elapsedTimeMs,
              });
            });
        } finally {
          bitmap.close();
        }
      })
      .catch((err: unknown) => {
        // このリクエストが最新でない場合は無視
        if (!isLatestRequest({ renderer, requestId })) {
          return;
        }
        console.error("Failed to get cycle bitmap:", err);
        // フォールバック: 通常の描画
        renderDrawingAtTimeFallback({
          drawing,
          drawingRevision,
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
    drawingRevision,
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
 * 2. `getCycleBitmap`がエラーを返した場合
 *
 * 注意: この関数はImageBitmapキャッシュを更新しない。
 * `renderer.clear()`によりキャッシュは無効化されるが、
 * 新しいキャッシュは作成されない（通常の描画パスのため）。
 * 次回`getCycleBitmap`が呼ばれた際は、全ストロークから再生成される。
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
    renderer.renderStroke({
      stroke,
      jitteredPoints: jittered,
      elapsedTimeMs,
    });
  }

  // ImageDataベースの実装では、フレームごとに1回描画
  if ("flush" in renderer && typeof renderer.flush === "function") {
    renderer.flush();
  }
}
