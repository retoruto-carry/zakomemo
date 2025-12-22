import { getPatternDefinition } from "../core/patterns";
import type { PatternTile } from "../core/patternTypes";
import { bresenhamLine, calculateThickLinePixels } from "../core/pixelArt";
import type { BrushVariant, Stroke } from "../core/types";
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
 * Canvas 2D APIを使用して描画を行うレンダラー実装
 * ピクセルアート前提: 論理ピクセル単位のImageDataを保持し、フレームごとに1回描画
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

  constructor(options: CanvasRendererOptions) {
    this.ctx = options.ctx;
    this.backgroundColor = options.backgroundColor;
    this.backgroundColorRgba = parseColorToRgb(options.backgroundColor);
  }

  private ctx: CanvasRenderingContext2D;

  setBackgroundColor(backgroundColor: string): void {
    this.backgroundColor = backgroundColor;
    this.backgroundColorRgba = parseColorToRgb(backgroundColor);
    // 背景色が変更された場合、ImageDataを再初期化
    if (this.imageData) {
      this.initializeImageData(this.lastWidth, this.lastHeight);
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

    // 1点だけのとき
    if (jitteredPoints.length === 1) {
      const p = jitteredPoints[0];
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      this.drawPatternPixelToImageData(
        x,
        y,
        brushWidth,
        tile,
        color.r,
        color.g,
        color.b,
      );
      return;
    }

    // パフォーマンス最適化: まずエリアを特定
    let areaPixels: Array<{ x: number; y: number }>;

    if (brushWidth > 1) {
      // 太い線の場合: 中心線を取得してから、太い線のエリアを計算
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

      // 太い線のエリアを計算（重複排除済み）
      areaPixels = calculateThickLinePixels(centerPixels, brushWidth);
    } else {
      // width=1の場合: 中心線のピクセルを取得
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

      // Mapから配列に変換
      areaPixels = [];
      pixels.forEach((ys, x) => {
        ys.forEach((y) => {
          areaPixels.push({ x, y });
        });
      });
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
   * エリア全体にパターンを一括適用
   * 各ピクセルについて、パターンのタイル位置を計算して描画
   */
  private applyPatternToArea(
    areaPixels: Array<{ x: number; y: number }>,
    tile: PatternTile,
    r: number,
    g: number,
    b: number,
    width: number,
  ): void {
    if (width === 1) {
      // width=1の場合: 周囲チェックが必要（線が途切れないように）
      for (const pixel of areaPixels) {
        this.drawPatternPixelToImageData(
          pixel.x,
          pixel.y,
          width,
          tile,
          r,
          g,
          b,
        );
      }
    } else {
      // width > 1の場合: 各ピクセルについてパターンのタイル位置を計算
      for (const pixel of areaPixels) {
        const tileX = ((pixel.x % tile.width) + tile.width) % tile.width;
        const tileY = ((pixel.y % tile.height) + tile.height) % tile.height;
        const alphaIndex = tileY * tile.width + tileX;
        if (alphaIndex >= 0 && alphaIndex < tile.alpha.length) {
          const alpha = tile.alpha[alphaIndex];
          if (alpha > 0) {
            this.setPixel(pixel.x, pixel.y, r, g, b, alpha * 255);
          }
        }
      }
    }
  }

  /**
   * パターンの1ピクセルをImageDataに書き込む
   */
  private drawPatternPixelToImageData(
    x: number,
    y: number,
    width: number,
    tile: PatternTile,
    r: number,
    g: number,
    b: number,
  ): void {
    if (!this.data) return;

    if (width === 1) {
      let maxAlpha = 0;

      // パフォーマンス最適化:
      // 1. 検索範囲を固定値（3ピクセル）に制限
      // 2. 距離の近い順にチェック（中心から外側へ）することで、早期終了が可能
      // 3. Math.sqrt()を完全に避けて、距離の2乗で比較することで高速化
      const searchRadius = 3;
      const maxDistanceSq = searchRadius * searchRadius;

      // 距離の近い順にチェック（中心から外側へ）
      // 距離0, 1, 2, 3の順でチェック
      for (let distance = 0; distance <= searchRadius; distance++) {
        let foundClose = false;

        // 現在の距離の範囲内の点をチェック（正方形の範囲）
        for (let dy = -distance; dy <= distance; dy++) {
          for (let dx = -distance; dx <= distance; dx++) {
            // 距離の2乗でチェック（Math.sqrt()を避ける）
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
                // 距離の2乗を使用して重みを計算（Math.sqrt()を避ける）
                // 近似式: sqrt(dSq) ≈ dSq / (1 + dSq) を使用
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

        // 早期終了: 距離1以内でalpha>0を見つけ、重みが十分大きい場合は終了
        if (foundClose && maxAlpha >= 0.7) {
          break;
        }
      }

      if (maxAlpha > 0) {
        this.setPixel(x, y, r, g, b, maxAlpha * 255);
      }
    } else {
      // width > 1の場合: 各ピクセルについてパターンを計算
      const radius = Math.floor(width / 2);
      const radiusSq = radius * radius;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dSq = dx * dx + dy * dy;
          if (dSq <= radiusSq) {
            const px = x + dx;
            const py = y + dy;
            const tileX = ((px % tile.width) + tile.width) % tile.width;
            const tileY = ((py % tile.height) + tile.height) % tile.height;
            const alphaIndex = tileY * tile.width + tileX;
            if (alphaIndex >= 0 && alphaIndex < tile.alpha.length) {
              const alpha = tile.alpha[alphaIndex];
              if (alpha > 0) {
                this.setPixel(px, py, r, g, b, alpha * 255);
              }
            }
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
  }
}
