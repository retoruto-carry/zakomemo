import type { JitterConfig } from "@/core/jitter";
import { applyJitterToStroke } from "@/core/strokeJitter";
import type { Drawing, Stroke } from "@/core/types";
import type { ImageDataBuffer } from "@/infra/canvas/ImageDataBuffer";
import { renderStroke } from "@/infra/canvas/strokeRendering";
import type { StrokeWithNewPoints } from "@/infra/canvas/types";

/** フレーム全再生成の入力 */
export type BuildFromScratchParams = {
  drawing: Drawing;
  cycleElapsedTimeMs: number;
  jitterConfig: JitterConfig;
  palette: string[];
};

/** フレーム差分生成の入力 */
export type BuildWithDiffParams = {
  drawing: Drawing;
  cycleElapsedTimeMs: number;
  jitterConfig: JitterConfig;
  palette: string[];
  newStrokes: Stroke[];
  strokesWithNewPoints: StrokeWithNewPoints[];
  baseBitmap: ImageBitmap;
};

/**
 * DrawingからImageBitmapを生成する。
 * 共有のImageDataバッファを使い、全再生成と差分描画に対応する。
 */
export class FrameBuilder {
  private buffer: ImageDataBuffer;

  constructor({ buffer }: { buffer: ImageDataBuffer }) {
    this.buffer = buffer;
  }

  /** 指定のcycle時間でフレームを全再生成する */
  async buildFromScratch({
    drawing,
    cycleElapsedTimeMs,
    jitterConfig,
    palette,
  }: BuildFromScratchParams): Promise<ImageBitmap> {
    this.buffer.clear({ width: drawing.width, height: drawing.height });

    for (const stroke of drawing.strokes) {
      const jittered = applyJitterToStroke({
        stroke,
        elapsedTimeMs: cycleElapsedTimeMs,
        jitterConfig,
      });
      renderStroke({
        context: this.buffer,
        palette,
        stroke,
        jitteredPoints: jittered,
        elapsedTimeMs: cycleElapsedTimeMs,
      });
    }

    return await this.buffer.createBitmap();
  }

  /** baseBitmapに新規ストローク/新規ポイントのみを反映して生成する */
  async buildWithDiff({
    drawing,
    cycleElapsedTimeMs,
    jitterConfig,
    palette,
    newStrokes,
    strokesWithNewPoints,
    baseBitmap,
  }: BuildWithDiffParams): Promise<ImageBitmap> {
    this.buffer.loadFromBitmap({
      bitmap: baseBitmap,
      width: drawing.width,
      height: drawing.height,
    });

    for (const stroke of newStrokes) {
      const jittered = applyJitterToStroke({
        stroke,
        elapsedTimeMs: cycleElapsedTimeMs,
        jitterConfig,
      });
      renderStroke({
        context: this.buffer,
        palette,
        stroke,
        jitteredPoints: jittered,
        elapsedTimeMs: cycleElapsedTimeMs,
      });
    }

    for (const { stroke, cachedPointCount } of strokesWithNewPoints) {
      const startIndex = Math.max(0, cachedPointCount - 1);
      const pointsForJitter = stroke.points.slice(startIndex);
      if (pointsForJitter.length === 0) continue;

      const tempStroke: Stroke = {
        ...stroke,
        points: pointsForJitter,
      };
      const jittered = applyJitterToStroke({
        stroke: tempStroke,
        elapsedTimeMs: cycleElapsedTimeMs,
        jitterConfig,
      });
      renderStroke({
        context: this.buffer,
        palette,
        stroke: tempStroke,
        jitteredPoints: jittered,
        elapsedTimeMs: cycleElapsedTimeMs,
      });
    }

    return await this.buffer.createBitmap();
  }
}
