import type { DrawingRenderer } from "../engine/ports";
import type { Stroke } from "../core/types";
import { getPatternDefinition } from "../core/patterns";
import { wigglePatternTile, type PatternWiggleConfig } from "../core/patternDeform";
import { parseColorToRgb } from "./colorUtil";

export class CanvasRenderer implements DrawingRenderer {
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private wiggleConfig: PatternWiggleConfig
  ) {}

  clear(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.ctx.clearRect(0, 0, width, height);
  }

  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    timeMs: number
  ): void {
    if (jitteredPoints.length < 2) return;
    const ctx = this.ctx;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
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
          timeMs
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
    timeMs: number
  ): CanvasPattern {
    const def = getPatternDefinition(patternId as any);
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
    return pattern;
  }
}
