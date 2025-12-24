import type { JitterConfig } from "../../core/jitter";
import type { Drawing, Stroke } from "../../core/types";

/**
 * CanvasRendererの初期化オプション
 */
export interface CanvasRendererOptions {
  /** Canvas 2Dコンテキスト */
  ctx: CanvasRenderingContext2D;
  /** 背景色（CSS色文字列） */
  backgroundColor: string;
}

/**
 * フレームBitmap取得の引数
 */
export type GetFrameBitmapParams = {
  drawing: Drawing;
  frameIndex: number;
  jitterConfig: JitterConfig;
  elapsedTimeMs: number;
};

/**
 * 全ストロークからフレーム生成の引数
 */
export type RenderFrameFromScratchParams = {
  drawing: Drawing;
  frameIndex: number;
  frameElapsedTimeMs: number;
  jitterConfig: JitterConfig;
};

/**
 * 差分描画の引数
 */
export type RenderFrameWithDiffParams = {
  drawing: Drawing;
  frameIndex: number;
  frameElapsedTimeMs: number;
  jitterConfig: JitterConfig;
  newStrokes: Stroke[];
};

/**
 * 新しいポイントがあるストローク
 */
export type StrokeWithNewPoints = {
  stroke: Stroke;
  cachedPointCount: number;
};

/**
 * キャッシュ状態
 */
export type CacheState = {
  strokeIds: Set<string>;
  strokePointCounts: Map<string, number>;
  drawingHash: string | null;
  jitterConfig: JitterConfig | null;
};
