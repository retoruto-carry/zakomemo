import type { JitterConfig } from "@/core/jitter";
import type { Drawing, Stroke } from "@/core/types";
import type { DrawingRenderer, GetCycleBitmapParams } from "@/engine/ports";
import { CYCLE_COUNT, CYCLE_INTERVAL_MS } from "@/engine/renderingConstants";
import { CycleBitmapCache } from "@/infra/canvas/CycleBitmapCache";
import { FrameBuilder } from "@/infra/canvas/FrameBuilder";
import { ImageDataBuffer } from "@/infra/canvas/ImageDataBuffer";
import { StrokeChangeTracker } from "@/infra/canvas/StrokeChangeTracker";
import { renderStroke } from "@/infra/canvas/strokeRendering";
import type { CanvasRendererOptions, FrameKey } from "@/infra/canvas/types";

/** undo/redoの体感を優先しつつメモリを抑えるための保持数 */
const MAX_DRAWING_CACHE_ENTRIES = 6;
/** LRUに保持するImageBitmap数（cycle枚数込み） */
const MAX_BITMAP_CACHE_ENTRIES = MAX_DRAWING_CACHE_ENTRIES * CYCLE_COUNT;

/**
 * ImageBitmapのcycleキャッシュを使うCanvasレンダラー。
 * キャッシュ参照の制御を行い、実描画は各ヘルパーに委譲する。
 */
export class CanvasRenderer implements DrawingRenderer {
  private ctx: CanvasRenderingContext2D;
  private displayBuffer: ImageDataBuffer;
  private cycleBuffers: ImageDataBuffer[];
  private frameBuilders: FrameBuilder[];
  private cycleCache: CycleBitmapCache;
  private renderCacheEpoch = 0;
  private cycleIntervalMs = CYCLE_INTERVAL_MS;
  /** Drawing参照に安定IDを付け、undo/redoで同じ状態を再利用できるようにする */
  private drawingIds = new WeakMap<Drawing, number>();
  private nextDrawingId = 1;

  constructor(options: CanvasRendererOptions) {
    this.ctx = options.ctx;
    this.displayBuffer = new ImageDataBuffer({
      ctx: options.ctx,
      backgroundColor: options.backgroundColor,
    });
    this.cycleBuffers = Array.from(
      { length: CYCLE_COUNT },
      () =>
        new ImageDataBuffer({
          ctx: options.ctx,
          backgroundColor: options.backgroundColor,
        }),
    );
    this.frameBuilders = this.cycleBuffers.map(
      (buffer) => new FrameBuilder({ buffer }),
    );
    this.cycleCache = new CycleBitmapCache({
      cycleCount: CYCLE_COUNT,
      createTracker: () => new StrokeChangeTracker(),
      maxEntries: MAX_BITMAP_CACHE_ENTRIES,
    });
  }

  setBackgroundColor(backgroundColor: string): void {
    this.displayBuffer.setBackgroundColor({ backgroundColor });
    for (const buffer of this.cycleBuffers) {
      buffer.setBackgroundColor({ backgroundColor });
    }
    this.invalidateCache();
  }

  clear(width: number, height: number): void {
    this.displayBuffer.clear({ width, height });
    this.invalidateCache();
  }

  invalidateRenderCache(): void {
    this.invalidateCache();
  }

  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    _elapsedTimeMs: number,
  ): void {
    renderStroke({
      context: this.displayBuffer,
      stroke,
      jitteredPoints,
      elapsedTimeMs: _elapsedTimeMs,
    });
  }

  flush(): void {
    if (!this.displayBuffer.hasImageData()) return;
    const { width, height } = this.displayBuffer.getSize();
    const dpr = window.devicePixelRatio || 1;
    this.displayBuffer.putToOffscreen();

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.displayBuffer.getOffscreenCanvas(),
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
    return this.displayBuffer.getImageData();
  }

  getCycleCount(): number {
    return CYCLE_COUNT;
  }

  /**
   * 指定のDrawing状態とcycleIndexに対応するImageBitmapを取得する。
   * キャッシュとin-flightを再利用して重複生成を避ける。
   * 返却したImageBitmapは呼び出し側がcloseする（内部キャッシュはcloneを保持）。
   */
  async getCycleBitmap(params: GetCycleBitmapParams): Promise<ImageBitmap> {
    const { drawing, drawingRevision, cycleIndex, jitterConfig } = params;

    this.assertCycleIndex({ cycleIndex });
    const sizeChanged = this.displayBuffer.ensureSize({
      width: drawing.width,
      height: drawing.height,
    });
    if (sizeChanged) {
      this.invalidateCache();
    }

    const jitterKey = this.getJitterKey({ jitterConfig });
    // 差分更新でも揺れの位相がぶれないよう、cycleIndexで固定した時間を使う。
    const cycleElapsedTimeMs = cycleIndex * this.cycleIntervalMs;
    const cycleBuffer = this.cycleBuffers[cycleIndex];
    const frameBuilder = this.frameBuilders[cycleIndex];
    const key: FrameKey = { drawingRevision, jitterKey, cycleIndex };
    const cacheKey = this.getCacheKey({
      drawing,
      renderCacheEpoch: this.renderCacheEpoch,
      jitterKey,
      cycleIndex,
    });

    const cached = this.cycleCache.getBitmap({
      key,
      cacheKey,
      renderCacheEpoch: this.renderCacheEpoch,
    });
    if (cached) {
      try {
        const cloned = await this.cloneBitmap({ bitmap: cached });
        this.cycleCache.getTracker({ cycleIndex }).sync({ drawing });
        return cloned;
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
      cacheKey,
      drawing,
      jitterConfig,
      cycleElapsedTimeMs,
      cycleBuffer,
      frameBuilder,
      renderCacheEpoch,
    }).finally(() => {
      this.cycleCache.clearInFlight({ cycleIndex });
    });

    this.cycleCache.setInFlight({ key, promise: buildPromise });

    const bitmap = await buildPromise;
    return await this.cloneBitmap({ bitmap });
  }

  flushFromBitmap(bitmap: ImageBitmap): void {
    const { width, height } = this.displayBuffer.getSize();
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
    cacheKey,
    jitterConfig,
    cycleElapsedTimeMs,
    cycleBuffer,
    frameBuilder,
    renderCacheEpoch,
  }: {
    key: FrameKey;
    drawing: Drawing;
    cacheKey: string;
    jitterConfig: JitterConfig;
    cycleElapsedTimeMs: number;
    cycleBuffer: ImageDataBuffer;
    frameBuilder: FrameBuilder;
    renderCacheEpoch: number;
  }): Promise<ImageBitmap> {
    cycleBuffer.ensureSize({ width: drawing.width, height: drawing.height });
    const tracker = this.cycleCache.getTracker({ cycleIndex: key.cycleIndex });
    const baseBitmap = this.cycleCache.getBaseBitmap({
      cycleIndex: key.cycleIndex,
      renderCacheEpoch,
    });
    const diff = tracker.diff({ drawing });

    let bitmap: ImageBitmap;

    if (diff.mode === "diff" && baseBitmap) {
      try {
        bitmap = await frameBuilder.buildWithDiff({
          drawing,
          cycleElapsedTimeMs,
          jitterConfig,
          newStrokes: diff.newStrokes,
          strokesWithNewPoints: diff.strokesWithNewPoints,
          baseBitmap,
        });
      } catch {
        bitmap = await frameBuilder.buildFromScratch({
          drawing,
          cycleElapsedTimeMs,
          jitterConfig,
        });
      }
    } else {
      bitmap = await frameBuilder.buildFromScratch({
        drawing,
        cycleElapsedTimeMs,
        jitterConfig,
      });
    }

    if (this.renderCacheEpoch !== renderCacheEpoch) {
      bitmap.close();
      throw new Error("renderCacheEpoch changed");
    }

    const committed = this.cycleCache.commit({
      key,
      cacheKey,
      renderCacheEpoch,
      bitmap,
    });
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

  private getDrawingId({ drawing }: { drawing: Drawing }): number {
    const existing = this.drawingIds.get(drawing);
    if (existing) return existing;
    const nextId = this.nextDrawingId;
    this.nextDrawingId += 1;
    this.drawingIds.set(drawing, nextId);
    return nextId;
  }

  /** 描画条件が変わったときに誤ヒットしないよう複合キーにする */
  private getCacheKey({
    drawing,
    renderCacheEpoch,
    jitterKey,
    cycleIndex,
  }: {
    drawing: Drawing;
    renderCacheEpoch: number;
    jitterKey: string;
    cycleIndex: number;
  }): string {
    const drawingId = this.getDrawingId({ drawing });
    return `${drawingId}|${renderCacheEpoch}|${jitterKey}|${cycleIndex}`;
  }

  private async cloneBitmap({
    bitmap,
  }: {
    bitmap: ImageBitmap;
  }): Promise<ImageBitmap> {
    return await createImageBitmap(bitmap);
  }
}
