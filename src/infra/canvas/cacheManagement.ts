/**
 * キャッシュ管理ロジック
 * ストロークのキャッシュ状態を管理し、差分描画に必要な情報を提供
 */

import type { JitterConfig } from "../../core/jitter";
import type { Drawing, Stroke } from "../../core/types";
import type { CacheState, StrokeWithNewPoints } from "./types";

/**
 * Drawingのハッシュを計算（キャッシュのキー用）
 * 注意: jitterConfigは別途チェックするため、ハッシュには含めない
 */
export function computeDrawingHash(drawing: Drawing): string {
  const strokeInfo = drawing.strokes
    .map((s) => `${s.id}:${s.points.length}`)
    .join(",");
  return `${drawing.width}x${drawing.height}:${drawing.strokes.length}:${strokeInfo}`;
}

/**
 * jitterConfigがキャッシュと一致するかチェック
 */
export function isJitterConfigEqual(
  cached: JitterConfig | null,
  current: JitterConfig,
): boolean {
  if (!cached) return false;
  return (
    cached.amplitude === current.amplitude &&
    cached.frequency === current.frequency
  );
}

/**
 * 新しいストロークのみを取得（差分描画用）
 */
export function getNewStrokes(
  drawing: Drawing,
  cachedStrokeIds: Set<string>,
): Stroke[] {
  const newStrokes = drawing.strokes.filter(
    (stroke) => !cachedStrokeIds.has(stroke.id),
  );
  if (newStrokes.length > 0) {
    console.log(
      `[CanvasRenderer] getNewStrokes: ${newStrokes.length}個の新しいストローク検出`,
      newStrokes.map((s) => ({ id: s.id, points: s.points.length })),
    );
  }
  return newStrokes;
}

/**
 * ポイント数が増えたストロークを取得（差分描画用）
 * 既存のストロークで、ポイント数が増えているものを返す
 */
export function getStrokesWithNewPoints(
  drawing: Drawing,
  cachedStrokeIds: Set<string>,
  cachedStrokePointCounts: Map<string, number>,
): StrokeWithNewPoints[] {
  const result: StrokeWithNewPoints[] = [];
  for (const stroke of drawing.strokes) {
    if (!cachedStrokeIds.has(stroke.id)) continue; // 新しいストロークは除外
    const cachedCount = cachedStrokePointCounts.get(stroke.id) ?? 0;
    if (stroke.points.length > cachedCount) {
      result.push({
        stroke,
        cachedPointCount: cachedCount,
      });
    }
  }
  if (result.length > 0) {
    console.log(
      `[CanvasRenderer] getStrokesWithNewPoints: ${result.length}個のストロークに新しいポイント`,
      result.map((r) => ({
        id: r.stroke.id,
        cached: r.cachedPointCount,
        current: r.stroke.points.length,
        new: r.stroke.points.length - r.cachedPointCount,
      })),
    );
  }
  return result;
}

/**
 * 差分描画時のキャッシュ更新
 */
export function updateCacheForDiff(
  state: CacheState,
  newStrokes: Stroke[],
  strokesWithNewPoints: StrokeWithNewPoints[],
  drawing: Drawing,
  jitterConfig: JitterConfig,
): void {
  // 新しいストロークのIDとポイント数を更新
  for (const stroke of newStrokes) {
    state.strokeIds.add(stroke.id);
    state.strokePointCounts.set(stroke.id, stroke.points.length);
  }
  // 既存のストロークのポイント数も更新
  for (const { stroke } of strokesWithNewPoints) {
    state.strokePointCounts.set(stroke.id, stroke.points.length);
  }
  const drawingHash = computeDrawingHash(drawing);
  state.drawingHash = drawingHash;
  state.jitterConfig = { ...jitterConfig };
}

/**
 * 全再生成時のキャッシュ更新
 */
export function updateCacheForScratch(
  state: CacheState,
  drawing: Drawing,
  jitterConfig: JitterConfig,
): void {
  // キャッシュされたストロークIDとポイント数を更新
  state.strokeIds.clear();
  state.strokePointCounts.clear();
  for (const stroke of drawing.strokes) {
    state.strokeIds.add(stroke.id);
    state.strokePointCounts.set(stroke.id, stroke.points.length);
  }
  const drawingHash = computeDrawingHash(drawing);
  state.drawingHash = drawingHash;
  state.jitterConfig = { ...jitterConfig };
  console.log(
    `[CanvasRenderer] updateCacheForScratch: キャッシュ更新 drawingHash=${drawingHash}, strokes=${drawing.strokes.length}`,
  );
}
