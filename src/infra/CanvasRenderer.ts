import type { JitterConfig } from "../core/jitter";
import { getPatternDefinition } from "../core/patterns";
import type { PatternTile } from "../core/patternTypes";
import { bresenhamLine, calculateThickLinePixels } from "../core/pixelArt";
import type { BrushVariant, Drawing, Stroke } from "../core/types";
import { applyJitterToStroke } from "../engine/frameRenderer";
import type { DrawingRenderer } from "../engine/ports";
import { parseColorToRgb, resolveCssVariable } from "./colorUtil";
import {
  clearHistoryCache,
  getFromHistoryCache,
  type HistoryCache,
  MAX_HISTORY_CACHE_SIZE,
  saveAndEvict,
} from "./historyCache";

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

type RenderFrameWithDiffParams = {
  drawing: Drawing;
  frameIndex: number;
  frameElapsedTimeMs: number;
  jitterConfig: JitterConfig;
  newStrokes: Stroke[];
};

type StrokeWithNewPoints = {
  stroke: Stroke;
  cachedPointCount: number;
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
  private cachedStrokePointCounts: Map<string, number> = new Map();
  private cachedDrawingHash: string | null = null;
  private cachedJitterConfig: JitterConfig | null = null;

  // バックグラウンド生成の制御
  private backgroundGenerationAbortController: AbortController | null = null;
  private isDrawingActive = false; // ストローク描画中かどうか

  // 履歴キャッシュ（undo/redo用）
  private historyCache: HistoryCache = new Map();

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
   * 背景色変更、パレット変更、clear()などで呼ばれる
   * @param clearHistory 履歴キャッシュもクリアするか（デフォルト: true）
   * 注意: undo/redo時はclearHistory=falseで呼ばれる（履歴キャッシュを保持するため）
   */
  private invalidateCache(clearHistory = true): void {
    // 既存のバックグラウンド生成をキャンセル
    if (this.backgroundGenerationAbortController) {
      this.backgroundGenerationAbortController.abort();
      this.backgroundGenerationAbortController = null;
    }
    // 既存のImageBitmapを破棄
    for (let i = 0; i < this.frameBitmaps.length; i++) {
      if (this.frameBitmaps[i]) {
        this.frameBitmaps[i]?.close();
        this.frameBitmaps[i] = null;
      }
    }
    this.cachedStrokeIds.clear();
    this.cachedStrokePointCounts.clear();
    this.cachedDrawingHash = null;
    this.cachedJitterConfig = null;
    // 履歴キャッシュもクリア（背景色変更などは全履歴に影響するため）
    if (clearHistory) {
      this.clearHistoryCache();
    }
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
   * @param cached キャッシュされたjitterConfig（省略時はthis.cachedJitterConfig）
   * @param current 現在のjitterConfig（省略時は引数なしで呼ばれた場合の処理）
   */
  private isJitterConfigEqual(
    cached: JitterConfig | null,
    current?: JitterConfig,
  ): boolean {
    // 引数が1つの場合（後方互換性のため）
    if (current === undefined) {
      const config = cached as JitterConfig;
      if (!this.cachedJitterConfig) return false;
      return (
        this.cachedJitterConfig.amplitude === config.amplitude &&
        this.cachedJitterConfig.frequency === config.frequency
      );
    }
    // 引数が2つの場合
    if (!cached) return false;
    return (
      cached.amplitude === current.amplitude &&
      cached.frequency === current.frequency
    );
  }

  /**
   * 新しいストロークのみを取得（差分描画用）
   */
  private getNewStrokes(drawing: Drawing): Stroke[] {
    const newStrokes = drawing.strokes.filter(
      (stroke) => !this.cachedStrokeIds.has(stroke.id),
    );
    if (newStrokes.length > 0) {
      console.log(
        `[CanvasRenderer] getNewStrokes: ${newStrokes.length}個の新しいストローク検出`,
        newStrokes.map((s) => ({ id: s.id, points: s.points.length })),
      );
    }
    return newStrokes;
  }

  /**
   * ポイント数が増えたストロークを取得（差分描画用）
   * 既存のストロークで、ポイント数が増えているものを返す
   */
  private getStrokesWithNewPoints(drawing: Drawing): StrokeWithNewPoints[] {
    const result: StrokeWithNewPoints[] = [];
    for (const stroke of drawing.strokes) {
      if (!this.cachedStrokeIds.has(stroke.id)) continue; // 新しいストロークは除外
      const cachedCount = this.cachedStrokePointCounts.get(stroke.id) ?? 0;
      if (stroke.points.length > cachedCount) {
        result.push({
          stroke,
          cachedPointCount: cachedCount,
        });
      }
    }
    if (result.length > 0) {
      console.log(
        `[CanvasRenderer] getStrokesWithNewPoints: ${result.length}個のストロークに新しいポイント`,
        result.map((r) => ({
          id: r.stroke.id,
          cached: r.cachedPointCount,
          current: r.stroke.points.length,
          new: r.stroke.points.length - r.cachedPointCount,
        })),
      );
    }
    return result;
  }

  /**
   * 差分描画時のキャッシュ更新
   */
  private updateCacheForDiff(
    newStrokes: Stroke[],
    strokesWithNewPoints: StrokeWithNewPoints[],
    drawing: Drawing,
    jitterConfig: JitterConfig,
  ): void {
    // 新しいストロークのIDとポイント数を更新
    for (const stroke of newStrokes) {
      this.cachedStrokeIds.add(stroke.id);
      this.cachedStrokePointCounts.set(stroke.id, stroke.points.length);
    }
    // 既存のストロークのポイント数も更新
    for (const { stroke } of strokesWithNewPoints) {
      this.cachedStrokePointCounts.set(stroke.id, stroke.points.length);
    }
    const drawingHash = this.computeDrawingHash(drawing);
    this.cachedDrawingHash = drawingHash;
    this.cachedJitterConfig = { ...jitterConfig };
  }

  /**
   * 全再生成時のキャッシュ更新
   */
  private updateCacheForScratch(
    drawing: Drawing,
    jitterConfig: JitterConfig,
  ): void {
    // キャッシュされたストロークIDとポイント数を更新
    this.cachedStrokeIds.clear();
    this.cachedStrokePointCounts.clear();
    for (const stroke of drawing.strokes) {
      this.cachedStrokeIds.add(stroke.id);
      this.cachedStrokePointCounts.set(stroke.id, stroke.points.length);
    }
    const drawingHash = this.computeDrawingHash(drawing);
    this.cachedDrawingHash = drawingHash;
    this.cachedJitterConfig = { ...jitterConfig };
    console.log(
      `[CanvasRenderer] updateCacheForScratch: キャッシュ更新 drawingHash=${drawingHash}, strokes=${drawing.strokes.length}`,
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
   * ストローク描画中の状態を設定
   * バックグラウンド生成を制御するために使用
   */
  setIsDrawingActive(active: boolean): void {
    this.isDrawingActive = active;
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

    // まず履歴キャッシュをチェック（undo/redo用）
    const historyCacheEntry = getFromHistoryCache(
      this.historyCache,
      drawingHash,
    );
    if (
      historyCacheEntry &&
      this.isJitterConfigEqual(historyCacheEntry.jitterConfig, jitterConfig) &&
      historyCacheEntry.frameBitmaps[frameIndex] !== null
    ) {
      const cached = historyCacheEntry.frameBitmaps[frameIndex];
      if (!cached) {
        throw new Error(
          `Frame bitmap at index ${frameIndex} is null in history cache`,
        );
      }
      // ImageBitmapが有効かどうかを確認（無効な場合は再生成）
      // 注意: ImageBitmapにはclosedプロパティがないため、実際に使用してみてエラーが発生するかどうかで判断
      // ここでは、履歴キャッシュから取得したImageBitmapをそのまま返す
      // エラーが発生した場合は、frameRenderer.tsでフォールバック処理が行われる
      console.log(
        `[CanvasRenderer] getFrameBitmap: 履歴キャッシュヒット frameIndex=${frameIndex}`,
      );
      // 現在のキャッシュも更新（次回の高速化のため）
      // ただし、履歴キャッシュのImageBitmapは参照を共有しているため、
      // ここでframeBitmapsに設定すると、後でclose()されたときに履歴キャッシュも無効になる
      // そのため、履歴キャッシュから取得したImageBitmapは、frameBitmapsには設定しない
      this.cachedDrawingHash = drawingHash;
      this.cachedJitterConfig = { ...jitterConfig };
      this.cachedStrokeIds.clear();
      for (const stroke of drawing.strokes) {
        this.cachedStrokeIds.add(stroke.id);
      }
      return cached;
    }

    // 通常のキャッシュが有効かチェック
    // 条件: Drawingのハッシュが一致、jitterConfigが一致、ImageBitmapが存在
    const isCacheValid =
      this.cachedDrawingHash === drawingHash &&
      this.isJitterConfigEqual(this.cachedJitterConfig, jitterConfig) &&
      this.frameBitmaps[frameIndex] !== null;

    if (!isCacheValid) {
      console.log(`[CanvasRenderer] getFrameBitmap: キャッシュ無効の理由`, {
        drawingHashMatch: this.cachedDrawingHash === drawingHash,
        jitterConfigMatch: this.isJitterConfigEqual(
          this.cachedJitterConfig,
          jitterConfig,
        ),
        frameBitmapExists: this.frameBitmaps[frameIndex] !== null,
        cachedDrawingHash: this.cachedDrawingHash,
        currentDrawingHash: drawingHash,
        cachedJitterConfig: this.cachedJitterConfig,
        currentJitterConfig: jitterConfig,
      });
    }

    if (isCacheValid) {
      // 新しいストロークがあるかチェック
      const newStrokes = this.getNewStrokes(drawing);
      const strokesWithNewPoints = this.getStrokesWithNewPoints(drawing);
      if (newStrokes.length === 0 && strokesWithNewPoints.length === 0) {
        // キャッシュが有効で新しいストロークがない場合は、既存のImageBitmapを返す
        console.log(
          `[CanvasRenderer] getFrameBitmap: キャッシュヒット frameIndex=${frameIndex}`,
        );
        const cached = this.frameBitmaps[frameIndex];
        if (!cached) {
          throw new Error(`Frame bitmap at index ${frameIndex} is null`);
        }
        return cached;
      }

      // 新しいストロークがある場合: 差分描画で効率的に更新
      // 前のImageBitmapに新しいストロークだけを上書き
      // ただし、全消しの場合は全再生成（drawing.strokes.length === 0）
      console.log(
        `[CanvasRenderer] getFrameBitmap: 差分描画 frameIndex=${frameIndex}, newStrokes=${newStrokes.length}, strokesWithNewPoints=${strokesWithNewPoints.length}`,
      );
      const frameElapsedTimeMs = frameIndex * 100; // 100ms = 10fps
      const requested =
        drawing.strokes.length === 0
          ? // 全消しの場合は全再生成
            await this.renderFrameFromScratch({
              drawing,
              frameIndex,
              frameElapsedTimeMs,
              jitterConfig,
            })
          : // 通常の場合は差分描画
            await this.renderFrameWithDiff({
              drawing,
              frameIndex,
              frameElapsedTimeMs,
              jitterConfig,
              newStrokes,
            });

      // 他のフレームは非同期で生成（ブロックしない）
      this.regenerateOtherFramesAsync(drawing, jitterConfig, frameIndex);

      return requested;
    }

    // キャッシュが無効な場合: 要求されたフレームを優先的に生成
    console.log(
      `[CanvasRenderer] getFrameBitmap: キャッシュ無効、全再生成 frameIndex=${frameIndex}, strokes=${drawing.strokes.length}`,
    );
    const frameElapsedTimeMs = frameIndex * 100; // 100ms = 10fps
    const requested = await this.renderFrameFromScratch({
      drawing,
      frameIndex,
      frameElapsedTimeMs,
      jitterConfig,
    });

    // 他のフレームは非同期で生成（ブロックしない）
    this.regenerateOtherFramesAsync(drawing, jitterConfig, frameIndex);

    return requested;
  }

  /**
   * 他のフレームを非同期で再生成（バックグラウンド生成）
   * 描画をブロックしないように、非同期で実行
   * ストローク描画中は実行しない（パフォーマンスへの影響を避ける）
   */
  private regenerateOtherFramesAsync(
    drawing: Drawing,
    jitterConfig: JitterConfig,
    excludeIndex: number,
  ): void {
    // ストローク描画中はバックグラウンド生成をスキップ
    if (this.isDrawingActive) {
      console.log(
        `[CanvasRenderer] regenerateOtherFramesAsync: スキップ（描画中） excludeIndex=${excludeIndex}`,
      );
      return;
    }
    console.log(
      `[CanvasRenderer] regenerateOtherFramesAsync: 開始 excludeIndex=${excludeIndex}`,
    );

    // 既存のバックグラウンド生成をキャンセル
    if (this.backgroundGenerationAbortController) {
      this.backgroundGenerationAbortController.abort();
    }
    this.backgroundGenerationAbortController = new AbortController();
    const signal = this.backgroundGenerationAbortController.signal;

    const frameCount = FRAME_COUNT;
    const frameInterval = 100; // 100ms = 10fps

    // 他のフレームを非同期で生成（awaitしない）
    for (let i = 0; i < frameCount; i++) {
      if (i === excludeIndex) continue;

      const frameElapsedTimeMs = i * frameInterval;
      // 非同期で実行（ブロックしない）
      // 新しいストロークまたは新しいポイントがある場合は差分描画、ない場合は全再生成
      // ただし、全消しの場合は全再生成（drawing.strokes.length === 0）
      const newStrokes = this.getNewStrokes(drawing);
      const strokesWithNewPoints = this.getStrokesWithNewPoints(drawing);
      const hasNewContent =
        newStrokes.length > 0 || strokesWithNewPoints.length > 0;
      const renderPromise =
        drawing.strokes.length === 0 ||
        !hasNewContent ||
        this.frameBitmaps[i] === null
          ? // 全再生成（全消し、または新しいコンテンツがない、または前のImageBitmapがない場合）
            // バックグラウンド生成ではキャッシュを更新しない（要求されたフレームが既に更新しているため）
            this.renderFrameFromScratch(
              {
                drawing,
                frameIndex: i,
                frameElapsedTimeMs,
                jitterConfig,
              },
              false, // updateCache = false
            )
          : // 差分描画（新しいストロークまたは新しいポイントがあり、前のImageBitmapがある場合）
            // バックグラウンド生成ではキャッシュを更新しない（要求されたフレームが既に更新しているため）
            this.renderFrameWithDiff(
              {
                drawing,
                frameIndex: i,
                frameElapsedTimeMs,
                jitterConfig,
                newStrokes,
              },
              false, // updateCache = false
            );

      renderPromise
        .then((bitmap) => {
          // キャンセルされていない場合のみ更新
          if (!signal.aborted) {
            this.frameBitmaps[i]?.close();
            this.frameBitmaps[i] = bitmap;
          } else {
            // キャンセルされた場合は破棄
            bitmap.close();
          }
        })
        .catch((err) => {
          if (!signal.aborted) {
            console.error(`Failed to generate frame ${i}:`, err);
          }
        });
    }
  }

  /**
   * 差分描画: 前のImageBitmapに新しいストロークだけを上書き
   * リアルタイム描画時のパフォーマンス最適化
   * @param updateCache キャッシュを更新するか（デフォルト: true）
   * 注意: `regenerateOtherFramesAsync`から呼ばれる場合は、要求されたフレームが既にキャッシュを更新しているため、
   * バックグラウンド生成ではキャッシュを更新しない（競合を避けるため）
   */
  private async renderFrameWithDiff(
    params: RenderFrameWithDiffParams,
    updateCache = true,
  ): Promise<ImageBitmap> {
    const {
      drawing,
      frameIndex,
      frameElapsedTimeMs,
      jitterConfig,
      newStrokes,
    } = params;

    const strokesWithNewPoints = this.getStrokesWithNewPoints(drawing);
    console.log(
      `[CanvasRenderer] renderFrameWithDiff: 開始 frameIndex=${frameIndex}, newStrokes=${newStrokes.length}, strokesWithNewPoints=${strokesWithNewPoints.length}`,
    );

    // 前のImageBitmapを取得
    const previousBitmap = this.frameBitmaps[frameIndex];
    if (!previousBitmap) {
      console.log(
        `[CanvasRenderer] renderFrameWithDiff: 前のImageBitmapがないため全再生成にフォールバック`,
      );
      // 前のImageBitmapがない場合は全再生成
      return await this.renderFrameFromScratch({
        drawing,
        frameIndex,
        frameElapsedTimeMs,
        jitterConfig,
      });
    }

    // ImageBitmapからImageDataを取得
    // 一時的なCanvasを使用
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.lastWidth;
    tempCanvas.height = this.lastHeight;
    const tempCtx = tempCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!tempCtx) {
      throw new Error("Failed to get 2D context for temp canvas");
    }
    tempCtx.drawImage(previousBitmap, 0, 0);

    // getImageDataの失敗を考慮（メモリ不足時など）
    let imageData: ImageData;
    try {
      imageData = tempCtx.getImageData(0, 0, this.lastWidth, this.lastHeight);
    } catch (error) {
      // getImageDataが失敗した場合は、全再生成にフォールバック
      console.error(
        `[CanvasRenderer] renderFrameWithDiff: getImageData failed, falling back to renderFrameFromScratch`,
        error,
      );
      return await this.renderFrameFromScratch({
        drawing,
        frameIndex,
        frameElapsedTimeMs,
        jitterConfig,
      });
    }
    const data = imageData.data;

    // 一時的にImageDataを置き換え
    const originalImageData = this.imageData;
    const originalData = this.data;
    this.imageData = imageData;
    this.data = data;

    try {
      // 新しいストロークだけを描画
      for (const stroke of newStrokes) {
        const jittered = applyJitterToStroke({
          stroke,
          elapsedTimeMs: frameElapsedTimeMs,
          jitterConfig,
        });
        this.renderStroke(stroke, jittered, frameElapsedTimeMs);
      }

      // 既存のストロークの新しいポイントだけを描画
      for (const { stroke, cachedPointCount } of strokesWithNewPoints) {
        // 新しいポイントを取得（前のポイントとの接続のため、1つ前のポイントも含める）
        const startIndex = Math.max(0, cachedPointCount - 1);
        const pointsForJitter = stroke.points.slice(startIndex);
        if (pointsForJitter.length === 0) continue;

        // 新しいポイントだけを含む一時的なストロークを作成してjitterを適用
        // これにより、既に描画済みのポイントにjitterを適用する無駄を避ける
        const tempStroke: Stroke = {
          ...stroke,
          points: pointsForJitter,
        };
        const jittered = applyJitterToStroke({
          stroke: tempStroke,
          elapsedTimeMs: frameElapsedTimeMs,
          jitterConfig,
        });

        // 新しいポイントだけを描画
        this.renderStroke(stroke, jittered, frameElapsedTimeMs);
      }

      // ImageDataをオフスクリーンCanvasに書き込む
      if (!this.offscreenCanvas || !this.offscreenCtx) {
        throw new Error(
          `Offscreen canvas is not initialized. Canvas: ${
            this.offscreenCanvas !== null
          }, Context: ${this.offscreenCtx !== null}`,
        );
      }
      this.offscreenCtx.putImageData(this.imageData, 0, 0);

      // ImageBitmapを作成
      const newBitmap = await createImageBitmap(this.offscreenCanvas);

      // キャッシュを更新
      this.frameBitmaps[frameIndex]?.close();
      this.frameBitmaps[frameIndex] = newBitmap;

      // キャッシュを更新（要求されたフレームのみ）
      if (updateCache) {
        this.updateCacheForDiff(
          newStrokes,
          strokesWithNewPoints,
          drawing,
          jitterConfig,
        );
      }

      // すべてのフレームが生成された場合、履歴キャッシュに保存
      // 非同期処理のため、awaitしない（描画をブロックしない）
      const allFramesReady = this.frameBitmaps.every((b) => b !== null);
      if (allFramesReady) {
        const drawingHash = this.computeDrawingHash(drawing);
        // 非同期で実行（エラーが発生しても描画処理は続行）
        void this.saveToHistoryCache(drawingHash, jitterConfig);
      }

      return newBitmap;
    } finally {
      // ImageDataを元に戻す
      this.imageData = originalImageData;
      this.data = originalData;
      // tempCanvasを明示的にクリーンアップ（メモリリーク防止）
      // 注意: DOM要素は自動的にGCされるが、明示的にnullに設定することで
      // メモリ使用量を早めに解放できる可能性がある
      tempCanvas.width = 0;
      tempCanvas.height = 0;
    }
  }

  /**
   * 全ストロークからフレームを生成
   * @param updateCache キャッシュを更新するか（デフォルト: true）
   * 注意: `regenerateOtherFramesAsync`から呼ばれる場合は、要求されたフレームが既にキャッシュを更新しているため、
   * バックグラウンド生成ではキャッシュを更新しない（競合を避けるため）
   */
  private async renderFrameFromScratch(
    params: RenderFrameFromScratchParams,
    updateCache = true,
  ): Promise<ImageBitmap> {
    const { drawing, frameIndex, frameElapsedTimeMs, jitterConfig } = params;
    console.log(
      `[CanvasRenderer] renderFrameFromScratch: 開始 frameIndex=${frameIndex}, strokes=${drawing.strokes.length}, updateCache=${updateCache}`,
    );
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
    console.log(
      `[CanvasRenderer] renderFrameFromScratch: 完了 frameIndex=${frameIndex}`,
    );

    // キャッシュを更新
    this.frameBitmaps[frameIndex]?.close();
    this.frameBitmaps[frameIndex] = newBitmap;

    // キャッシュを更新（要求されたフレームのみ）
    if (updateCache) {
      this.updateCacheForScratch(drawing, jitterConfig);
    }

    // すべてのフレームが生成された場合、履歴キャッシュに保存
    // ただし、すべてのフレームが生成されている場合のみ
    // 非同期処理のため、awaitしない（描画をブロックしない）
    const allFramesReady = this.frameBitmaps.every((b) => b !== null);
    if (allFramesReady) {
      const drawingHash = this.computeDrawingHash(drawing);
      // 非同期で実行（エラーが発生しても描画処理は続行）
      void this.saveToHistoryCache(drawingHash, jitterConfig);
    }

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

  /**
   * 履歴キャッシュに保存
   * すべてのフレームが生成された場合に呼ばれる
   *
   * ImageBitmapをクローンして保存することで、参照共有による問題を回避する。
   * 非同期処理のため、エラーが発生しても描画処理は続行される。
   */
  private async saveToHistoryCache(
    drawingHash: string,
    jitterConfig: JitterConfig,
  ): Promise<void> {
    try {
      // ImageBitmapをクローン（参照を共有しないようにする）
      const clonedBitmaps: (ImageBitmap | null)[] = [];
      const clonePromises: Promise<void>[] = [];

      for (let i = 0; i < FRAME_COUNT; i++) {
        const bitmap = this.frameBitmaps[i];
        if (bitmap) {
          // createImageBitmapでクローン（非同期）
          clonePromises.push(
            createImageBitmap(bitmap).then((cloned) => {
              clonedBitmaps[i] = cloned;
            }),
          );
        } else {
          clonedBitmaps[i] = null;
        }
      }

      // すべてのクローンが完了するまで待機
      await Promise.all(clonePromises);

      // 履歴キャッシュに保存し、古いエントリを削除
      const toClose = saveAndEvict(
        this.historyCache,
        drawingHash,
        {
          frameBitmaps: clonedBitmaps,
          jitterConfig: { ...jitterConfig },
          timestamp: Date.now(),
        },
        MAX_HISTORY_CACHE_SIZE,
      );

      // 削除されたエントリのImageBitmapを破棄
      for (const entry of toClose) {
        for (const bitmap of entry.frameBitmaps) {
          if (bitmap) {
            bitmap.close();
          }
        }
      }
    } catch (error) {
      // エラーが発生しても描画処理は続行（ログのみ出力）
      console.error(
        `[CanvasRenderer] saveToHistoryCache: エラーが発生しました`,
        error,
      );
    }
  }

  /**
   * 履歴キャッシュをクリア
   */
  private clearHistoryCache(): void {
    const entries = clearHistoryCache(this.historyCache);
    // ImageBitmapを破棄
    for (const entry of entries) {
      for (const bitmap of entry.frameBitmaps) {
        if (bitmap) {
          bitmap.close();
        }
      }
    }
  }
}
