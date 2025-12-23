import type { JitterConfig } from "../core/jitter";
import { getPatternDefinition } from "../core/patterns";
import type { PatternTile } from "../core/patternTypes";
import { bresenhamLine, calculateThickLinePixels } from "../core/pixelArt";
import type { BrushVariant, Drawing, Stroke } from "../core/types";
import { applyJitterToStroke } from "../engine/frameRenderer";
import type { DrawingRenderer } from "../engine/ports";
import { parseColorToRgb, resolveCssVariable } from "./colorUtil";

/**
 * CanvasRendererの初期化オプション
 */
interface CanvasRendererOptions {
  /** Canvas 2Dコンテキスト */
  ctx: CanvasRenderingContext2D;
  /** 背景色（CSS色文字列） */
  backgroundColor: string;
}

/**
 * フレーム数（固定）
 */
const FRAME_COUNT = 3;

/**
 * フレームBitmap取得の引数
 */
type GetFrameBitmapParams = {
  drawing: Drawing;
  frameIndex: number;
  jitterConfig: JitterConfig;
  elapsedTimeMs: number;
};

/**
 * 全ストロークからフレーム生成の引数
 */
type RenderFrameFromScratchParams = {
  drawing: Drawing;
  frameIndex: number;
  frameElapsedTimeMs: number;
  jitterConfig: JitterConfig;
};

/**
 * Canvas 2D APIを使用して描画を行うレンダラー実装
 * ピクセルアート前提: 論理ピクセル単位のImageDataを保持し、フレームごとに1回描画
 * パフォーマンス最適化: 3フレーム固定、ImageBitmapキャッシュ、差分描画
 */
export class CanvasRenderer implements DrawingRenderer {
  private lastWidth = 0;
  private lastHeight = 0;
  private backgroundColor: string;
  private backgroundColorRgba: { r: number; g: number; b: number; a: number };
  private imageData: ImageData | null = null;
  private data: Uint8ClampedArray | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  // ImageBitmapキャッシュ（3フレーム分）
  private frameBitmaps: (ImageBitmap | null)[] = [null, null, null];
  private cachedStrokeIds: Set<string> = new Set();
  private cachedDrawingHash: string | null = null;
  private cachedJitterConfig: JitterConfig | null = null;

  constructor(options: CanvasRendererOptions) {
    this.ctx = options.ctx;
    this.backgroundColor = options.backgroundColor;
    this.backgroundColorRgba = parseColorToRgb(options.backgroundColor);
  }

  private ctx: CanvasRenderingContext2D;

  setBackgroundColor(backgroundColor: string): void {
    this.backgroundColor = backgroundColor;
    this.backgroundColorRgba = parseColorToRgb(backgroundColor);
    // 背景色が変更された場合、ImageDataとキャッシュを再初期化
    if (this.imageData) {
      this.initializeImageData(this.lastWidth, this.lastHeight);
      this.invalidateCache();
    }
  }

  /**
   * ImageDataを初期化（背景色で塗りつぶす）
   * オフスクリーンCanvasも初期化（スケールアップ用）
   */
  private initializeImageData(width: number, height: number): void {
    this.imageData = this.ctx.createImageData(width, height);
    this.data = this.imageData.data;
    const bg = this.backgroundColorRgba;

    // 背景色で塗りつぶす
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = bg.r; // R
      this.data[i + 1] = bg.g; // G
      this.data[i + 2] = bg.b; // B
      this.data[i + 3] = bg.a * 255; // A (0-255)
    }

    // オフスクリーンCanvasを初期化（スケールアップ用）
    const dpr = window.devicePixelRatio || 1;
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = width * dpr;
    this.offscreenCanvas.height = height * dpr;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    if (this.offscreenCtx) {
      this.offscreenCtx.imageSmoothingEnabled = false;
    }
  }

  /**
   * 内部で保持しているキャンバスサイズ（lastWidth/lastHeight）も更新する
   * ImageDataを初期化（背景色で塗りつぶす）
   * @param width 論理ピクセル
   * @param height 論理ピクセル
   */
  clear(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.initializeImageData(width, height);
    this.invalidateCache();
  }

  /**
   * キャッシュを無効化
   * 背景色変更、パレット変更、undo/redo、clear()などで呼ばれる
   */
  private invalidateCache(): void {
    // 既存のImageBitmapを破棄
    for (let i = 0; i < this.frameBitmaps.length; i++) {
      if (this.frameBitmaps[i]) {
        this.frameBitmaps[i]?.close();
        this.frameBitmaps[i] = null;
      }
    }
    this.cachedStrokeIds.clear();
    this.cachedDrawingHash = null;
    this.cachedJitterConfig = null;
  }

  /**
   * Drawingのハッシュを計算（キャッシュのキー用）
   * 注意: jitterConfigは別途チェックするため、ハッシュには含めない
   */
  private computeDrawingHash(drawing: Drawing): string {
    const strokeInfo = drawing.strokes
      .map((s) => `${s.id}:${s.points.length}`)
      .join(",");
    return `${drawing.width}x${drawing.height}:${drawing.strokes.length}:${strokeInfo}`;
  }

  /**
   * jitterConfigがキャッシュと一致するかチェック
   */
  private isJitterConfigEqual(config: JitterConfig): boolean {
    if (!this.cachedJitterConfig) return false;
    return (
      this.cachedJitterConfig.amplitude === config.amplitude &&
      this.cachedJitterConfig.frequency === config.frequency
    );
  }

  /**
   * 新しいストロークのみを取得（差分描画用）
   */
  private getNewStrokes(drawing: Drawing): Stroke[] {
    return drawing.strokes.filter(
      (stroke) => !this.cachedStrokeIds.has(stroke.id),
    );
  }

  /**
   * ImageDataの指定座標にRGBA値を設定
   */
  private setPixel(
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    if (
      !this.data ||
      x < 0 ||
      y < 0 ||
      x >= this.lastWidth ||
      y >= this.lastHeight
    ) {
      return;
    }

    const index = (y * this.lastWidth + x) * 4;
    this.data[index] = r; // R
    this.data[index + 1] = g; // G
    this.data[index + 2] = b; // B
    this.data[index + 3] = a; // A
  }

  /**
   * ピクセル単位でストロークを描画
   * ソリッド/消しゴムはBresenhamアルゴリズムでピクセル単位描画
   * パターンはピクセル単位で実装
   * すべてImageDataに書き込む（Canvas APIは呼ばない）
   */
  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    _elapsedTimeMs: number,
  ): void {
    if (jitteredPoints.length === 0 || !this.data) return;

    // パターンの場合はピクセル単位描画
    if (stroke.brush.kind === "pattern") {
      this.renderPatternStroke(stroke, jitteredPoints);
      return;
    }

    // ソリッド/消しゴムはピクセル単位描画
    this.renderSolidStroke(stroke, jitteredPoints);
  }

  /**
   * ソリッド/消しゴムをピクセル単位で描画（ImageDataに書き込む）
   */
  private renderSolidStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
  ): void {
    const brushWidth = Math.round(stroke.brush.width);
    const variant = stroke.brush.variant as BrushVariant | undefined;

    // 色を取得
    let r: number;
    let g: number;
    let b: number;
    let a: number;

    if (stroke.kind === "erase") {
      // 消しゴム: 背景色で塗りつぶす
      const bg = this.backgroundColorRgba;
      r = bg.r;
      g = bg.g;
      b = bg.b;
      a = bg.a * 255; // 0-255に変換
    } else {
      // 通常のペン: ストロークの色を使用
      const color = parseColorToRgb(resolveCssVariable(stroke.brush.color));
      r = color.r;
      g = color.g;
      b = color.b;
      a = stroke.brush.opacity * 255; // 0-255に変換
    }

    // 1点だけのとき
    if (jitteredPoints.length === 1) {
      const p = jitteredPoints[0];
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      this.drawPixelToImageData(
        x,
        y,
        brushWidth,
        variant,
        stroke.kind,
        r,
        g,
        b,
        a,
      );
      return;
    }

    // パフォーマンス最適化: 太い線の場合は領域を直接計算
    if (brushWidth > 1) {
      // 中心線を取得
      const centerPixels: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < jitteredPoints.length; i++) {
        const current = jitteredPoints[i];
        const x = Math.round(current.x);
        const y = Math.round(current.y);

        if (i === 0) {
          centerPixels.push({ x, y });
        } else {
          // 前の点から現在の点までBresenhamで線を描画
          const prev = jitteredPoints[i - 1];
          const prevX = Math.round(prev.x);
          const prevY = Math.round(prev.y);
          const linePixels = bresenhamLine(prevX, prevY, x, y);
          // 最初の点は重複するのでスキップ
          if (linePixels.length > 0) {
            centerPixels.push(...linePixels.slice(1));
          }
        }
      }

      // 太い線の領域を計算（重複排除済み）
      const thickPixels = calculateThickLinePixels(centerPixels, brushWidth);

      // 各ピクセルをImageDataに書き込む
      for (const pixel of thickPixels) {
        this.setPixel(pixel.x, pixel.y, r, g, b, a);
      }
    } else {
      // width=1の場合は従来通り（最適化済み）
      const pixels = new Map<number, Set<number>>(); // x -> Set<y>

      for (let i = 0; i < jitteredPoints.length; i++) {
        const current = jitteredPoints[i];
        const x = Math.round(current.x);
        const y = Math.round(current.y);

        if (i === 0) {
          if (!pixels.has(x)) pixels.set(x, new Set());
          pixels.get(x)?.add(y);
        } else {
          const prev = jitteredPoints[i - 1];
          const prevX = Math.round(prev.x);
          const prevY = Math.round(prev.y);
          const linePixels = bresenhamLine(prevX, prevY, x, y);
          linePixels.forEach((pixel) => {
            if (!pixels.has(pixel.x)) pixels.set(pixel.x, new Set());
            pixels.get(pixel.x)?.add(pixel.y);
          });
        }
      }

      // 各ピクセルをImageDataに書き込む
      pixels.forEach((ys, x) => {
        ys.forEach((y) => {
          this.setPixel(x, y, r, g, b, a);
        });
      });
    }
  }

  /**
   * 1ピクセルをImageDataに書き込む（太い線の場合は拡大）
   */
  private drawPixelToImageData(
    x: number,
    y: number,
    width: number,
    variant: BrushVariant | undefined,
    strokeKind: "draw" | "erase",
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    if (strokeKind === "erase" && variant === "eraserLine") {
      // 消しゴム（横線）: 横方向に拡大
      const halfLen = Math.round(width);
      for (let dx = -halfLen; dx <= halfLen; dx++) {
        this.setPixel(x + dx, y, r, g, b, a);
      }
    } else if (strokeKind === "erase" && variant === "eraserSquare") {
      // 消しゴム（四角）: 四角形で描画
      const halfWidth = Math.floor(width / 2);
      for (let dy = -halfWidth; dy < halfWidth; dy++) {
        for (let dx = -halfWidth; dx < halfWidth; dx++) {
          this.setPixel(x + dx, y + dy, r, g, b, a);
        }
      }
    } else {
      // 通常のペン/消しゴム（円）: 円で描画
      if (width === 1) {
        this.setPixel(x, y, r, g, b, a);
      } else {
        const radius = Math.floor(width / 2);
        const radiusSq = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const dSq = dx * dx + dy * dy;
            if (dSq <= radiusSq) {
              this.setPixel(x + dx, y + dy, r, g, b, a);
            }
          }
        }
      }
    }
  }

  /**
   * パターンストロークをピクセル単位で描画（ImageDataに書き込む）
   * 最適化: まずエリアを特定してから、そのエリア全体にパターンを一括適用
   */
  private renderPatternStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
  ): void {
    if (stroke.brush.kind !== "pattern" || !stroke.brush.patternId) return;

    const patternDef = getPatternDefinition(stroke.brush.patternId);
    if (!patternDef) return;
    const tile = patternDef.tile;

    const color = parseColorToRgb(resolveCssVariable(stroke.brush.color));
    const brushWidth = Math.round(stroke.brush.width);

    let areaPixels: Array<{ x: number; y: number }>;

    // 1点だけのとき
    if (jitteredPoints.length === 1) {
      const p = jitteredPoints[0];
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (brushWidth > 1) {
        areaPixels = calculateThickLinePixels([{ x, y }], brushWidth);
      } else {
        areaPixels = [{ x, y }];
      }
    } else {
      // 複数点の場合はBresenhamアルゴリズムで中心線を取得
      const centerPixels: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < jitteredPoints.length; i++) {
        const current = jitteredPoints[i];
        const x = Math.round(current.x);
        const y = Math.round(current.y);

        if (i === 0) {
          centerPixels.push({ x, y });
        } else {
          const prev = jitteredPoints[i - 1];
          const prevX = Math.round(prev.x);
          const prevY = Math.round(prev.y);
          const linePixels = bresenhamLine(prevX, prevY, x, y);
          if (linePixels.length > 0) {
            centerPixels.push(...linePixels.slice(1));
          }
        }
      }

      // 太い線の場合は領域を計算（重複排除済み）
      if (brushWidth > 1) {
        areaPixels = calculateThickLinePixels(centerPixels, brushWidth);
      } else {
        areaPixels = centerPixels;
      }
    }

    // エリア全体にパターンを一括適用
    this.applyPatternToArea(
      areaPixels,
      tile,
      color.r,
      color.g,
      color.b,
      brushWidth,
    );
  }

  /**
   * エリア全体にパターンを適用（ImageDataに書き込む）
   */
  private applyPatternToArea(
    areaPixels: Array<{ x: number; y: number }>,
    tile: PatternTile,
    r: number,
    g: number,
    b: number,
    brushWidth: number,
  ): void {
    if (!this.data) return;

    if (tile.width <= 0 || tile.height <= 0 || tile.alpha.length === 0) {
      return;
    }

    for (const { x, y } of areaPixels) {
      if (brushWidth === 1) {
        // width=1の場合: 周囲をチェックしてパターンを適用
        let maxAlpha = 0;
        const searchRadius = 3;
        const maxDistanceSq = searchRadius * searchRadius;

        for (let distance = 0; distance <= searchRadius; distance++) {
          let foundClose = false;
          for (let dy = -distance; dy <= distance; dy++) {
            for (let dx = -distance; dx <= distance; dx++) {
              const dSq = dx * dx + dy * dy;
              if (dSq > maxDistanceSq) continue;

              const px = x + dx;
              const py = y + dy;
              const tileX = ((px % tile.width) + tile.width) % tile.width;
              const tileY = ((py % tile.height) + tile.height) % tile.height;
              const alphaIndex = tileY * tile.width + tileX;

              if (alphaIndex >= 0 && alphaIndex < tile.alpha.length) {
                const alpha = tile.alpha[alphaIndex];
                if (alpha > 0) {
                  const approximateDistance = dSq / (1 + dSq);
                  const weight =
                    dSq === 0 ? 1.0 : 1.0 / (1.0 + approximateDistance * 0.3);
                  const weightedAlpha = alpha * weight;
                  if (weightedAlpha > maxAlpha) {
                    maxAlpha = weightedAlpha;
                    if (distance <= 1) {
                      foundClose = true;
                    }
                  }
                }
              }
            }
          }
          if (foundClose && maxAlpha >= 0.7) {
            break;
          }
        }
        if (maxAlpha > 0) {
          this.setPixel(x, y, r, g, b, maxAlpha * 255);
        }
      } else {
        // width > 1の場合: 各ピクセルについてパターンを計算
        const tileX = ((x % tile.width) + tile.width) % tile.width;
        const tileY = ((y % tile.height) + tile.height) % tile.height;
        const alphaIndex = tileY * tile.width + tileX;
        if (alphaIndex >= 0 && alphaIndex < tile.alpha.length) {
          const alpha = tile.alpha[alphaIndex];
          if (alpha > 0) {
            this.setPixel(x, y, r, g, b, alpha * 255);
          }
        }
      }
    }
  }

  /**
   * ImageDataをCanvasに描画（フレームごとに1回呼ばれる）
   * オフスクリーンCanvasにImageDataを描画してから、スケールアップしてメインCanvasに描画
   */
  flush(): void {
    if (this.imageData && this.offscreenCanvas && this.offscreenCtx) {
      const dpr = window.devicePixelRatio || 1;

      // オフスクリーンCanvasにImageDataを描画（論理ピクセルサイズ）
      this.offscreenCtx.putImageData(this.imageData, 0, 0);

      // メインCanvasにスケールアップして描画
      // Canvasのスケール変換をリセットしてから描画
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(
        this.offscreenCanvas,
        0,
        0,
        this.lastWidth,
        this.lastHeight,
        0,
        0,
        this.lastWidth * dpr,
        this.lastHeight * dpr,
      );
      this.ctx.restore();
    }
  }

  /**
   * 現在のImageDataを取得（GIFエクスポート用）
   * @throws ImageDataが初期化されていない場合
   */
  getImageData(): ImageData {
    if (!this.imageData) {
      throw new Error("ImageData is not initialized. Call clear() first.");
    }
    return this.imageData;
  }

  clearPatternCache(): void {
    // パターンキャッシュは不要（ImageDataベースの実装では）
    // ImageBitmapキャッシュもクリア（undo/redo時など）
    this.invalidateCache();
  }

  /**
   * フレーム数を取得（固定値）
   */
  getFrameCount(): number {
    return FRAME_COUNT;
  }

  /**
   * 指定フレームのImageBitmapを取得（キャッシュから、または生成）
   * @param params フレームBitmap取得の引数
   * @returns ImageBitmap
   * @throws {Error} frameIndexが範囲外の場合
   */
  async getFrameBitmap(params: GetFrameBitmapParams): Promise<ImageBitmap> {
    const { drawing, frameIndex, jitterConfig } = params;
    if (frameIndex < 0 || frameIndex >= FRAME_COUNT) {
      throw new Error(
        `Frame index must be between 0 and ${
          FRAME_COUNT - 1
        }, got ${frameIndex}`,
      );
    }

    // ImageDataが初期化されていない場合は初期化
    if (
      !this.imageData ||
      this.lastWidth !== drawing.width ||
      this.lastHeight !== drawing.height
    ) {
      this.clear(drawing.width, drawing.height);
    }

    const drawingHash = this.computeDrawingHash(drawing);

    // キャッシュが有効かチェック
    // 条件: Drawingのハッシュが一致、jitterConfigが一致、ImageBitmapが存在
    const isCacheValid =
      this.cachedDrawingHash === drawingHash &&
      this.isJitterConfigEqual(jitterConfig) &&
      this.frameBitmaps[frameIndex] !== null;

    if (isCacheValid) {
      // 新しいストロークがあるかチェック
      const newStrokes = this.getNewStrokes(drawing);
      if (newStrokes.length === 0) {
        // キャッシュが有効で新しいストロークがない場合は、既存のImageBitmapを返す
        const cached = this.frameBitmaps[frameIndex];
        if (!cached) {
          throw new Error(`Frame bitmap at index ${frameIndex} is null`);
        }
        return cached;
      }

      // 新しいストロークがある場合: すべてのフレームを再生成
      // 理由: アニメーションでは3フレームすべてが必要なため、すべてを更新する必要がある
      // 消しゴムも同様に、既存のピクセルを消すため、全フレーム再生成が必要
      // 要求されたフレームを生成し、他のフレームも並列で生成する
      await this.regenerateAllFrames(drawing, jitterConfig);
      // 要求されたフレームを返す
      const requestedBitmap = this.frameBitmaps[frameIndex];
      if (!requestedBitmap) {
        throw new Error(
          `Frame bitmap at index ${frameIndex} is null after regeneration`,
        );
      }
      return requestedBitmap;
    }

    // キャッシュが無効な場合: すべてのフレームを再生成
    await this.regenerateAllFrames(drawing, jitterConfig);
    // 要求されたフレームを返す
    const requestedBitmap = this.frameBitmaps[frameIndex];
    if (!requestedBitmap) {
      throw new Error(
        `Frame bitmap at index ${frameIndex} is null after regeneration`,
      );
    }
    return requestedBitmap;
  }

  /**
   * すべてのフレームを再生成（新しいストローク追加時やclear()後など）
   */
  private async regenerateAllFrames(
    drawing: Drawing,
    jitterConfig: JitterConfig,
  ): Promise<void> {
    const frameCount = FRAME_COUNT;
    const frameInterval = 100; // 100ms = 10fps

    // すべてのフレームを並列で生成
    const promises: Promise<ImageBitmap>[] = [];
    for (let i = 0; i < frameCount; i++) {
      const frameElapsedTimeMs = i * frameInterval;
      promises.push(
        this.renderFrameFromScratch({
          drawing,
          frameIndex: i,
          frameElapsedTimeMs,
          jitterConfig,
        }),
      );
    }

    // すべてのフレームが生成されるまで待つ
    await Promise.all(promises);
  }

  /**
   * 全ストロークからフレームを生成
   */
  private async renderFrameFromScratch(
    params: RenderFrameFromScratchParams,
  ): Promise<ImageBitmap> {
    const { drawing, frameIndex, frameElapsedTimeMs, jitterConfig } = params;
    // ImageDataを初期化
    this.initializeImageData(this.lastWidth, this.lastHeight);

    // 全ストロークを描画
    for (const stroke of drawing.strokes) {
      const jittered = applyJitterToStroke({
        stroke,
        elapsedTimeMs: frameElapsedTimeMs,
        jitterConfig,
      });
      this.renderStroke(stroke, jittered, frameElapsedTimeMs);
    }

    // ImageDataをオフスクリーンCanvasに書き込む
    if (!this.offscreenCanvas || !this.offscreenCtx || !this.imageData) {
      throw new Error(
        `Offscreen canvas or ImageData is not initialized. Canvas: ${
          this.offscreenCanvas !== null
        }, Context: ${this.offscreenCtx !== null}, ImageData: ${
          this.imageData !== null
        }`,
      );
    }
    this.offscreenCtx.putImageData(this.imageData, 0, 0);

    // ImageBitmapを作成
    const newBitmap = await createImageBitmap(this.offscreenCanvas);

    // キャッシュを更新
    this.frameBitmaps[frameIndex]?.close();
    this.frameBitmaps[frameIndex] = newBitmap;

    // キャッシュされたストロークIDを更新
    this.cachedStrokeIds.clear();
    for (const stroke of drawing.strokes) {
      this.cachedStrokeIds.add(stroke.id);
    }
    this.cachedDrawingHash = this.computeDrawingHash(drawing);
    this.cachedJitterConfig = { ...jitterConfig }; // コピーを保存

    return newBitmap;
  }

  /**
   * ImageBitmapからメインキャンバスに描画
   */
  flushFromBitmap(bitmap: ImageBitmap): void {
    const dpr = window.devicePixelRatio || 1;

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      bitmap,
      0,
      0,
      this.lastWidth,
      this.lastHeight,
      0,
      0,
      this.lastWidth * dpr,
      this.lastHeight * dpr,
    );
    this.ctx.restore();
  }
}
