import type { Stroke } from "@/core/types";

/**
 * CanvasRendererの初期化オプション
 */
export interface CanvasRendererOptions {
  /** Canvas 2Dコンテキスト */
  ctx: CanvasRenderingContext2D;
  /** 背景色（CSS色文字列） */
  backgroundColor: string;
  /** パレット色（6色想定） */
  paletteColors?: string[];
}

/**
 * 新しいポイントがあるストローク
 */
export type StrokeWithNewPoints = {
  stroke: Stroke;
  cachedPointCount: number;
};

/**
 * サイクルベースレンダリングのフレーム識別キー
 */
export type FrameKey = {
  drawingRevision: number;
  jitterKey: string;
  cycleIndex: number;
};
