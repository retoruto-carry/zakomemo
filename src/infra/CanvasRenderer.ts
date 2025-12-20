import {
  type PatternWiggleConfig,
  wigglePatternTile,
} from "../core/patternDeform";
import { getPatternDefinition } from "../core/patterns";
import type { BrushPatternId, BrushVariant, Stroke } from "../core/types";
import type { DrawingRenderer } from "../engine/ports";
import { parseColorToRgb, resolveCssVariable } from "./colorUtil";

export class CanvasRenderer implements DrawingRenderer {
  private lastWidth = 0;
  private lastHeight = 0;
  private patternCache = new Map<
    string,
    { bucket: number; pattern: CanvasPattern }
  >();
  private patternCacheMs = 80; // ゆらぎを間引きしてパフォーマンスを稼ぐ

  constructor(
    private ctx: CanvasRenderingContext2D,
    private wiggleConfig: PatternWiggleConfig,
  ) {}

  clear(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    timeMs: number,
  ): void {
    if (jitteredPoints.length === 0) return;
    const ctx = this.ctx;

    ctx.save();

    const variant = stroke.brush.variant as BrushVariant | undefined;
    if (stroke.kind === "erase") {
      if (variant === "eraserSquare") {
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
      } else if (variant === "eraserLine") {
        ctx.lineCap = "square";
        ctx.lineJoin = "round";
      } else {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    } else {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    ctx.lineWidth = stroke.brush.width;

    if (stroke.kind === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = stroke.brush.opacity;
      if (stroke.brush.kind === "solid" || !stroke.brush.patternId) {
        // CSS変数を解決してCanvas APIで使用可能な色に変換
        ctx.strokeStyle = resolveCssVariable(stroke.brush.color);
      } else {
        const pattern = this.createWigglyPattern(
          stroke.brush.patternId,
          stroke.brush.color,
          timeMs,
        );
        ctx.strokeStyle = pattern;
      }
    }

    // 1点だけのときは点として描画
    if (jitteredPoints.length === 1) {
      const p = jitteredPoints[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      if (stroke.kind === "erase") {
        ctx.fillStyle = "rgba(0,0,0,1)";
      } else if (
        ctx.strokeStyle instanceof CanvasGradient ||
        ctx.strokeStyle instanceof CanvasPattern
      ) {
        ctx.fillStyle = ctx.strokeStyle as string;
      } else {
        ctx.fillStyle = ctx.strokeStyle as string;
      }
      ctx.fill();
      ctx.restore();
      return;
    }

    if (stroke.kind === "erase" && variant === "eraserLine") {
      const halfLen = stroke.brush.width;
      ctx.beginPath();
      jitteredPoints.forEach((p) => {
        ctx.moveTo(p.x - halfLen, p.y);
        ctx.lineTo(p.x + halfLen, p.y);
      });
      ctx.stroke();
    } else {
      ctx.beginPath();
      jitteredPoints.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.lastWidth, this.lastHeight);
  }

  clearPatternCache(): void {
    this.patternCache.clear();
  }

  private createWigglyPattern(
    patternId: string,
    color: string,
    timeMs: number,
  ): CanvasPattern {
    const cacheKey = `${patternId}:${color}`;
    const bucket = Math.floor(timeMs / this.patternCacheMs);
    const cached = this.patternCache.get(cacheKey);
    if (cached && cached.bucket === bucket) {
      return cached.pattern;
    }

    const def = getPatternDefinition(patternId as BrushPatternId);
    const tile = wigglePatternTile(def.tile, timeMs, this.wiggleConfig);

    // パターンスケール: 1 = 元サイズ、2 = 2倍（密度半分）
    const PATTERN_SCALE = 2;
    const offscreen = document.createElement("canvas");
    offscreen.width = tile.width * PATTERN_SCALE;
    offscreen.height = tile.height * PATTERN_SCALE;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) {
      throw new Error("2D context not available");
    }

    // 1x1のタイルをスケール倍に拡大して描画
    const imageData = offCtx.createImageData(tile.width, tile.height);
    const { r, g, b } = parseColorToRgb(color);

    for (let i = 0; i < tile.alpha.length; i += 1) {
      const alpha = tile.alpha[i];
      const idx = i * 4;
      imageData.data[idx + 0] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = Math.round(255 * alpha);
    }

    // 一時キャンバスに1xで描画し、スケール拡大
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = tile.width;
    tempCanvas.height = tile.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) throw new Error("2D context not available");
    tempCtx.putImageData(imageData, 0, 0);
    
    offCtx.imageSmoothingEnabled = false;
    offCtx.drawImage(tempCanvas, 0, 0, offscreen.width, offscreen.height);
    const pattern = this.ctx.createPattern(offscreen, "repeat");
    if (!pattern) {
      throw new Error("Failed to create canvas pattern");
    }

    this.patternCache.set(cacheKey, { bucket, pattern });
    return pattern;
  }
}
