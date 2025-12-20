import type { JitterOffset } from "../core/jitter";
import type { Stroke } from "../core/types";

export interface DrawingRenderer {
  clear(width: number, height: number): void;
  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    timeMs: number,
  ): void;
  clearPatternCache(): void;
  /** パターン描画用のグローバルオフセットを設定 */
  setPatternOffset?(offset: JitterOffset): void;
}

export interface TimeProvider {
  now(): number;
}

export interface RafScheduler {
  request(cb: () => void): number;
  cancel(id: number): void;
}

export interface GifEncoder {
  begin(width: number, height: number, fps: number): void;
  addFrame(imageData: ImageData): void;
  finish(): Promise<Blob>;
}

export type StrokeSoundInfo = {
  tool: "pen" | "pattern" | "eraser";
  speed: number;
  length: number;
  timeSinceStart: number;
};

export interface StrokeSound {
  onStrokeStart(info: StrokeSoundInfo): void;
  onStrokeUpdate(info: StrokeSoundInfo): void;
  onStrokeEnd(info: StrokeSoundInfo): void;
}
