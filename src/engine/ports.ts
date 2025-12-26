import type { JitterConfig } from "@/core/jitter";
import type { Drawing, Stroke } from "@/core/types";

/**
 * 描画レンダラーのインターフェース
 */
export interface DrawingRenderer {
  clear(width: number, height: number): void;
  renderStroke(params: {
    stroke: Stroke;
    jitteredPoints: { x: number; y: number }[];
    elapsedTimeMs: number;
  }): void;
  /** 描画キャッシュを無効化する */
  invalidateRenderCache(): void;
}

/**
 * パレット変更を受け取れるレンダラー
 */
export interface PaletteRenderer {
  setPaletteColors(palette: string[]): void;
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
 * 時間提供者のインターフェース
 */
export interface TimeProvider {
  now(): number;
}

/**
 * アニメーションフレームスケジューラーのインターフェース
 */
export interface RafScheduler {
  request(cb: () => void): number;
  cancel(id: number): void;
}

/**
 * GIFエンコーダーのインターフェース
 */
export interface GifEncoder {
  begin(width: number, height: number, fps: number): void;
  addFrame(imageData: ImageData): void;
  finish(): Promise<Blob>;
  setBackgroundColor(backgroundColor: string): void;
}

/**
 * ストローク音の情報
 */
export type StrokeSoundInfo = {
  tool: "pen" | "pattern" | "eraser";
  speed: number;
  length: number;
  timeSinceStart: number;
};

/**
 * ストローク音のインターフェース
 */
export interface StrokeSound {
  onStrokeStart(info: StrokeSoundInfo): void;
  onStrokeUpdate(info: StrokeSoundInfo): void;
  onStrokeEnd(info: StrokeSoundInfo): void;
}
