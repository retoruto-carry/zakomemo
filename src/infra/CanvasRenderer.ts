import { getPatternDefinition } from "../core/patterns";
import { bresenhamLine } from "../core/pixelArt";
import type { BrushPatternId, BrushVariant, Stroke } from "../core/types";
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
  private patternCache = new Map<string, CanvasPattern>();
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
   * パターンを描画（従来の方法、フェーズ5で実装予定）
   */
  private renderPatternStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
  ): void {
    const ctx = this.ctx;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.brush.width;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = stroke.brush.opacity;

    if (!stroke.brush.patternId) {
      ctx.restore();
      return;
    }

    const pattern = this.createWigglyPattern(
      stroke.brush.patternId,
      stroke.brush.color,
    );
    ctx.strokeStyle = pattern;

    // 1点だけのときは点として描画
    if (jitteredPoints.length === 1) {
      const p = jitteredPoints[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = pattern;
      ctx.fill();
      ctx.restore();
      return;
    }

    // 複数点の場合はパスとして描画
    ctx.beginPath();
    jitteredPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 最後にclear()で設定されたサイズ（lastWidth/lastHeight）の範囲を取得する
   */
  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.lastWidth, this.lastHeight);
  }

  clearPatternCache(): void {
    this.patternCache.clear();
  }

  /**
   * 同じpatternIdとcolorの組み合わせはキャッシュから返される
   * @throws パターン定義が見つからない場合、またはパターン生成に失敗した場合
   */
  private createWigglyPattern(patternId: string, color: string): CanvasPattern {
    // パターンタイルは静的なので、色とパターンIDのみでキャッシュ
    const cacheKey = `${patternId}:${color}`;
    const cached = this.patternCache.get(cacheKey);
    if (cached) return cached;

    const def = getPatternDefinition(patternId as BrushPatternId);
    const tile = def.tile;

    // オフスクリーンキャンバスでタイルを作成
    const offscreen = document.createElement("canvas");
    offscreen.width = tile.width;
    offscreen.height = tile.height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) throw new Error("2D context not available");

    const imageData = offCtx.createImageData(tile.width, tile.height);
    const { r, g, b } = parseColorToRgb(color);

    for (let i = 0; i < tile.alpha.length; i++) {
      const idx = i * 4;
      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = Math.round(255 * tile.alpha[i]);
    }
    offCtx.putImageData(imageData, 0, 0);

    const pattern = this.ctx.createPattern(offscreen, "repeat");
    if (!pattern) throw new Error("Failed to create canvas pattern");

    this.patternCache.set(cacheKey, pattern);
    return pattern;
  }
}
