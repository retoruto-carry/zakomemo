import {
  type PatternWiggleConfig,
  wigglePatternTile,
} from "../core/patternDeform";
import { getPatternDefinition } from "../core/patterns";
import type { BrushPatternId, BrushVariant, Stroke } from "../core/types";
import type { DrawingRenderer } from "../engine/ports";
import { parseColorToRgb } from "./colorUtil";

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
    if (jitteredPoints.length < 2) return;
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
        ctx.strokeStyle = stroke.brush.color;
      } else {
        const pattern = this.createWigglyPattern(
          stroke.brush.patternId,
          stroke.brush.color,
          timeMs,
        );
        ctx.strokeStyle = pattern;
      }
    }

    ctx.beginPath();
    jitteredPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.lastWidth, this.lastHeight);
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

    const offscreen = document.createElement("canvas");
    offscreen.width = tile.width;
    offscreen.height = tile.height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) {
      throw new Error("2D context not available");
    }

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

    offCtx.putImageData(imageData, 0, 0);
    const pattern = this.ctx.createPattern(offscreen, "repeat");
    if (!pattern) {
      throw new Error("Failed to create canvas pattern");
    }

    this.patternCache.set(cacheKey, { bucket, pattern });
    return pattern;
  }
}
