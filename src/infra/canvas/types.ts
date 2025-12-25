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
 * cycle Bitmap取得の引数
 */
export type GetCycleBitmapParams = {
  drawing: Drawing;
  drawingRevision: number;
  cycleIndex: number;
  jitterConfig: JitterConfig;
  elapsedTimeMs: number;
};

/**
 * 新しいポイントがあるストローク
 */
export type StrokeWithNewPoints = {
  stroke: Stroke;
  cachedPointCount: number;
};

export type FrameKey = {
  drawingRevision: number;
  jitterKey: string;
  cycleIndex: number;
};
