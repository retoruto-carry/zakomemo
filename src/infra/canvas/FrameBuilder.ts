import type { JitterConfig } from "../../core/jitter";
import type { Drawing, Stroke } from "../../core/types";
import { applyJitterToStroke } from "../../engine/frameRenderer";
import type { ImageDataBuffer } from "./ImageDataBuffer";
import { renderStroke } from "./strokeRendering";
import type { StrokeWithNewPoints } from "./types";

export type BuildFromScratchParams = {
  drawing: Drawing;
  cycleElapsedTimeMs: number;
  jitterConfig: JitterConfig;
};

export type BuildWithDiffParams = {
  drawing: Drawing;
  cycleElapsedTimeMs: number;
  jitterConfig: JitterConfig;
  newStrokes: Stroke[];
  strokesWithNewPoints: StrokeWithNewPoints[];
  baseBitmap: ImageBitmap;
};

/**
 * Builds ImageBitmap frames from a Drawing using a shared ImageData buffer.
 * Supports full rebuilds and incremental diffs based on stroke changes.
 */
export class FrameBuilder {
  private buffer: ImageDataBuffer;

  constructor({ buffer }: { buffer: ImageDataBuffer }) {
    this.buffer = buffer;
  }

  /** Build a full frame from scratch for the given cycle time. */
  async buildFromScratch({
    drawing,
    cycleElapsedTimeMs,
    jitterConfig,
  }: BuildFromScratchParams): Promise<ImageBitmap> {
    this.buffer.clear({ width: drawing.width, height: drawing.height });

    for (const stroke of drawing.strokes) {
      const jittered = applyJitterToStroke({
        stroke,
        elapsedTimeMs: cycleElapsedTimeMs,
        jitterConfig,
      });
      renderStroke(this.buffer, stroke, jittered, cycleElapsedTimeMs);
    }

    return await this.buffer.createBitmap();
  }

  /** Build a frame by applying only new strokes or new points on a base bitmap. */
  async buildWithDiff({
    drawing,
    cycleElapsedTimeMs,
    jitterConfig,
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
      renderStroke(this.buffer, stroke, jittered, cycleElapsedTimeMs);
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
      renderStroke(this.buffer, stroke, jittered, cycleElapsedTimeMs);
    }

    return await this.buffer.createBitmap();
  }
}
