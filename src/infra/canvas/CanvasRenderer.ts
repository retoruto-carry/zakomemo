import type { JitterConfig } from "../../core/jitter";
import type { Drawing, Stroke } from "../../core/types";
import type { DrawingRenderer } from "../../engine/ports";
import {
  CYCLE_COUNT,
  CYCLE_INTERVAL_MS,
} from "../../engine/renderingConstants";
import { CycleBitmapCache } from "./CycleBitmapCache";
import { FrameBuilder } from "./FrameBuilder";
import { ImageDataBuffer } from "./ImageDataBuffer";
import { StrokeChangeTracker } from "./StrokeChangeTracker";
import { renderStroke } from "./strokeRendering";
import type {
  CanvasRendererOptions,
  FrameKey,
  GetCycleBitmapParams,
} from "./types";

export class CanvasRenderer implements DrawingRenderer {
  private ctx: CanvasRenderingContext2D;
  private buffer: ImageDataBuffer;
  private frameBuilder: FrameBuilder;
  private cycleCache: CycleBitmapCache;
  private renderCacheEpoch = 0;
  private cycleIntervalMs = CYCLE_INTERVAL_MS;

  constructor(options: CanvasRendererOptions) {
    this.ctx = options.ctx;
    this.buffer = new ImageDataBuffer({
      ctx: options.ctx,
      backgroundColor: options.backgroundColor,
    });
    this.frameBuilder = new FrameBuilder({ buffer: this.buffer });
    this.cycleCache = new CycleBitmapCache({
      cycleCount: CYCLE_COUNT,
      createTracker: () => new StrokeChangeTracker(),
    });
  }

  setBackgroundColor(backgroundColor: string): void {
    this.buffer.setBackgroundColor({ backgroundColor });
    this.invalidateCache();
  }

  clear(width: number, height: number): void {
    this.buffer.clear({ width, height });
    this.invalidateCache();
  }

  clearPatternCache(): void {
    this.invalidateCache();
  }

  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    _elapsedTimeMs: number,
  ): void {
    renderStroke(this.buffer, stroke, jitteredPoints, _elapsedTimeMs);
  }

  flush(): void {
    if (!this.buffer.hasImageData()) return;
    const { width, height } = this.buffer.getSize();
    const dpr = window.devicePixelRatio || 1;
    this.buffer.putToOffscreen();

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.buffer.getOffscreenCanvas(),
      0,
      0,
      width,
      height,
      0,
      0,
      width * dpr,
      height * dpr,
    );
    this.ctx.restore();
  }

  getImageData(): ImageData {
    return this.buffer.getImageData();
  }

  getCycleCount(): number {
    return CYCLE_COUNT;
  }

  async getCycleBitmap(params: GetCycleBitmapParams): Promise<ImageBitmap> {
    const {
      drawing,
      drawingRevision,
      cycleIndex,
      jitterConfig,
      elapsedTimeMs,
    } = params;

    this.assertCycleIndex({ cycleIndex });
    const sizeChanged = this.buffer.ensureSize({
      width: drawing.width,
      height: drawing.height,
    });
    if (sizeChanged) {
      this.invalidateCache();
    }

    const jitterKey = this.getJitterKey({ jitterConfig });
    const cycleElapsedTimeMs =
      elapsedTimeMs + cycleIndex * this.cycleIntervalMs;
    const key: FrameKey = { drawingRevision, jitterKey, cycleIndex };

    const cached = this.cycleCache.getBitmap({
      key,
      renderCacheEpoch: this.renderCacheEpoch,
    });
    if (cached) {
      try {
        return await this.cloneBitmap({ bitmap: cached });
      } catch {
        this.cycleCache.resetCycle({ cycleIndex });
      }
    }

    const inFlight = this.cycleCache.getInFlight({ key });
    if (inFlight) {
      try {
        return await inFlight.then((bitmap) => this.cloneBitmap({ bitmap }));
      } catch {
        this.cycleCache.resetCycle({ cycleIndex });
      }
    }

    const renderCacheEpoch = this.renderCacheEpoch;
    const buildPromise = this.buildAndCommitCycleBitmap({
      key,
      drawing,
      jitterConfig,
      cycleElapsedTimeMs,
      renderCacheEpoch,
    }).finally(() => {
      this.cycleCache.clearInFlight({ cycleIndex });
    });

    this.cycleCache.setInFlight({ key, promise: buildPromise });

    const bitmap = await buildPromise;
    return await this.cloneBitmap({ bitmap });
  }

  flushFromBitmap(bitmap: ImageBitmap): void {
    const { width, height } = this.buffer.getSize();
    const dpr = window.devicePixelRatio || 1;

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    try {
      this.ctx.drawImage(
        bitmap,
        0,
        0,
        width,
        height,
        0,
        0,
        width * dpr,
        height * dpr,
      );
    } catch (error) {
      console.error(
        "[CanvasRenderer] flushFromBitmap: drawImage failed",
        error,
      );
    }
    this.ctx.restore();
  }

  private async buildAndCommitCycleBitmap({
    key,
    drawing,
    jitterConfig,
    cycleElapsedTimeMs,
    renderCacheEpoch,
  }: {
    key: FrameKey;
    drawing: Drawing;
    jitterConfig: JitterConfig;
    cycleElapsedTimeMs: number;
    renderCacheEpoch: number;
  }): Promise<ImageBitmap> {
    const tracker = this.cycleCache.getTracker({ cycleIndex: key.cycleIndex });
    const baseBitmap = this.cycleCache.getBaseBitmap({
      cycleIndex: key.cycleIndex,
      renderCacheEpoch,
    });
    const diff = tracker.diff({ drawing });

    let bitmap: ImageBitmap;

    if (diff.mode === "diff" && baseBitmap) {
      try {
        bitmap = await this.frameBuilder.buildWithDiff({
          drawing,
          cycleElapsedTimeMs,
          jitterConfig,
          newStrokes: diff.newStrokes,
          strokesWithNewPoints: diff.strokesWithNewPoints,
          baseBitmap,
        });
      } catch {
        bitmap = await this.frameBuilder.buildFromScratch({
          drawing,
          cycleElapsedTimeMs,
          jitterConfig,
        });
      }
    } else {
      bitmap = await this.frameBuilder.buildFromScratch({
        drawing,
        cycleElapsedTimeMs,
        jitterConfig,
      });
    }

    if (this.renderCacheEpoch !== renderCacheEpoch) {
      bitmap.close();
      throw new Error("renderCacheEpoch changed");
    }

    const committed = this.cycleCache.commit({ key, renderCacheEpoch, bitmap });
    if (committed) {
      tracker.sync({ drawing });
    }
    return bitmap;
  }

  private invalidateCache(): void {
    this.renderCacheEpoch += 1;
    this.cycleCache.resetAll();
  }

  private assertCycleIndex({ cycleIndex }: { cycleIndex: number }): void {
    if (cycleIndex < 0 || cycleIndex >= CYCLE_COUNT) {
      throw new Error(
        `cycleIndex must be between 0 and ${CYCLE_COUNT - 1}, got ${cycleIndex}`,
      );
    }
  }

  private getJitterKey({
    jitterConfig,
  }: {
    jitterConfig: JitterConfig;
  }): string {
    return `${jitterConfig.amplitude}:${jitterConfig.frequency}`;
  }

  private async cloneBitmap({
    bitmap,
  }: {
    bitmap: ImageBitmap;
  }): Promise<ImageBitmap> {
    return await createImageBitmap(bitmap);
  }
}
