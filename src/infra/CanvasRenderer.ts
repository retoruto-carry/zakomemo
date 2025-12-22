import { getPatternDefinition } from "../core/patterns";
import { bresenhamLine } from "../core/pixelArt";
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
 * DrawingRendererインターフェースを実装し、ストロークの描画とキャンバスの管理を行う
 */
export class CanvasRenderer implements DrawingRenderer {
  private lastWidth = 0;
  private lastHeight = 0;
  private backgroundColor: string;

  constructor(options: CanvasRendererOptions) {
    this.ctx = options.ctx;
    this.backgroundColor = options.backgroundColor;
  }

  private ctx: CanvasRenderingContext2D;

  setBackgroundColor(backgroundColor: string): void {
    this.backgroundColor = backgroundColor;
  }

  /**
   * 内部で保持しているキャンバスサイズ（lastWidth/lastHeight）も更新する
   * @param width 論理ピクセル
   * @param height 論理ピクセル
   */
  clear(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  /**
   * ピクセル単位でストロークを描画
   * ソリッド/消しゴムはBresenhamアルゴリズムでピクセル単位描画
   * パターンは後で実装（現時点では従来の方法を使用）
   * @param _elapsedTimeMs DrawingRendererインターフェースの要件として必要だが、現在の実装では未使用
   */
  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    _elapsedTimeMs: number,
  ): void {
    if (jitteredPoints.length === 0) return;

    // パターンの場合は従来の方法を使用（フェーズ5で実装予定）
    if (stroke.brush.kind === "pattern") {
      this.renderPatternStroke(stroke, jitteredPoints);
      return;
    }

    // ソリッド/消しゴムはピクセル単位描画
    this.renderSolidStroke(stroke, jitteredPoints);
  }

  /**
   * ソリッド/消しゴムをピクセル単位で描画
   */
  private renderSolidStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
  ): void {
    const ctx = this.ctx;
    const brushWidth = Math.round(stroke.brush.width);
    const variant = stroke.brush.variant as BrushVariant | undefined;

    ctx.save();

    if (stroke.kind === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = stroke.brush.opacity;
      ctx.fillStyle = resolveCssVariable(stroke.brush.color);
    }

    // 1点だけのとき
    if (jitteredPoints.length === 1) {
      const p = jitteredPoints[0];
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      this.drawPixel(ctx, x, y, brushWidth, variant, stroke.kind);
      ctx.restore();
      return;
    }

    // 複数点の場合はBresenhamアルゴリズムで各ピクセルを描画
    const pixels = new Set<string>(); // 重複を避けるためSetを使用

    for (let i = 0; i < jitteredPoints.length; i++) {
      const current = jitteredPoints[i];
      const x = Math.round(current.x);
      const y = Math.round(current.y);

      if (i === 0) {
        // 最初の点
        pixels.add(`${x},${y}`);
      } else {
        // 前の点から現在の点までBresenhamで線を描画
        const prev = jitteredPoints[i - 1];
        const prevX = Math.round(prev.x);
        const prevY = Math.round(prev.y);
        const linePixels = bresenhamLine(prevX, prevY, x, y);
        linePixels.forEach((pixel) => {
          pixels.add(`${pixel.x},${pixel.y}`);
        });
      }
    }

    // 各ピクセルを描画
    pixels.forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      this.drawPixel(ctx, x, y, brushWidth, variant, stroke.kind);
    });

    ctx.restore();
  }

  /**
   * 1ピクセルを描画（太い線の場合は拡大）
   */
  private drawPixel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    variant: BrushVariant | undefined,
    strokeKind: "draw" | "erase",
  ): void {
    if (strokeKind === "erase" && variant === "eraserLine") {
      // 消しゴム（横線）: 横方向に拡大
      const halfLen = Math.round(width);
      ctx.fillRect(x - halfLen, y, halfLen * 2, 1);
    } else if (strokeKind === "erase" && variant === "eraserSquare") {
      // 消しゴム（四角）: 四角形で描画
      ctx.fillRect(
        x - Math.floor(width / 2),
        y - Math.floor(width / 2),
        width,
        width,
      );
    } else {
      // 通常のペン/消しゴム（円）: 円で描画
      if (width === 1) {
        ctx.fillRect(x, y, 1, 1);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, Math.floor(width / 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * パターンをピクセル単位で描画
   */
  private renderPatternStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
  ): void {
    if (!stroke.brush.patternId) return;

    const ctx = this.ctx;
    const brushWidth = Math.round(stroke.brush.width);
    const patternDef = getPatternDefinition(stroke.brush.patternId);
    const tile = patternDef.tile;
    const { r, g, b } = parseColorToRgb(stroke.brush.color);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = stroke.brush.opacity;

    // 1点だけのとき
    if (jitteredPoints.length === 1) {
      const p = jitteredPoints[0];
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      this.drawPatternPixel(ctx, x, y, brushWidth, tile, r, g, b);
      ctx.restore();
      return;
    }

    // 複数点の場合はBresenhamアルゴリズムで各ピクセルを描画
    const pixels = new Set<string>(); // 重複を避けるためSetを使用

    for (let i = 0; i < jitteredPoints.length; i++) {
      const current = jitteredPoints[i];
      const x = Math.round(current.x);
      const y = Math.round(current.y);

      if (i === 0) {
        // 最初の点
        pixels.add(`${x},${y}`);
      } else {
        // 前の点から現在の点までBresenhamで線を描画
        const prev = jitteredPoints[i - 1];
        const prevX = Math.round(prev.x);
        const prevY = Math.round(prev.y);
        const linePixels = bresenhamLine(prevX, prevY, x, y);
        linePixels.forEach((pixel) => {
          pixels.add(`${pixel.x},${pixel.y}`);
        });
      }
    }

    // 各ピクセルを描画
    pixels.forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      this.drawPatternPixel(ctx, x, y, brushWidth, tile, r, g, b);
    });

    ctx.restore();
  }

  /**
   * パターンの1ピクセルを描画
   */
  private drawPatternPixel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    tile: { width: number; height: number; alpha: number[] },
    r: number,
    g: number,
    b: number,
  ): void {
    // タイル内の位置を計算（繰り返しパターン）
    const tileX = ((x % tile.width) + tile.width) % tile.width;
    const tileY = ((y % tile.height) + tile.height) % tile.height;
    const alphaIndex = tileY * tile.width + tileX;
    const alpha = tile.alpha[alphaIndex];

    if (alpha > 0) {
      // 透明度に応じてピクセルを描画
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      if (width === 1) {
        ctx.fillRect(x, y, 1, 1);
      } else {
        // 太い線の場合は各ピクセルを拡大して描画
        const halfWidth = Math.floor(width / 2);
        for (let dy = -halfWidth; dy <= halfWidth; dy++) {
          for (let dx = -halfWidth; dx <= halfWidth; dx++) {
            const px = x + dx;
            const py = y + dy;
            // 円形のブラシの場合は距離をチェック
            if (dx * dx + dy * dy <= halfWidth * halfWidth) {
              const tileX2 = ((px % tile.width) + tile.width) % tile.width;
              const tileY2 = ((py % tile.height) + tile.height) % tile.height;
              const alphaIndex2 = tileY2 * tile.width + tileX2;
              const alpha2 = tile.alpha[alphaIndex2];
              if (alpha2 > 0) {
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha2})`;
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
        }
      }
    }
  }

  /**
   * 最後にclear()で設定されたサイズ（lastWidth/lastHeight）の範囲を取得する
   */
  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.lastWidth, this.lastHeight);
  }

  clearPatternCache(): void {
    // パターンキャッシュは不要になったため、何もしない
  }
}
