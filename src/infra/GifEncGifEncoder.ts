import { applyPalette, GIFEncoder, quantize } from "gifenc";
import type { GifEncoder } from "@/engine/ports";
import { parseColorToRgb } from "./colorUtil";

/**
 * gifencライブラリを使用したGIFエンコーダー実装
 * 透明ピクセルを背景色でフラット化して色ズレを抑制
 */
export class GifEncGifEncoder implements GifEncoder {
  private encoder = GIFEncoder();
  private delayMs = 0;
  private backgroundColor: { r: number; g: number; b: number } = {
    r: 255,
    g: 255,
    b: 255,
  };

  setBackgroundColor(backgroundColor: string): void {
    this.backgroundColor = parseColorToRgb(backgroundColor);
  }

  begin(width: number, height: number, fps: number): void {
    this.delayMs = Math.round(1000 / fps);
    // gifenc writes header automatically on first frame in auto mode
    // but we can prime encoder if needed; storing dimensions for clarity
    void width;
    void height;
  }

  addFrame(imageData: ImageData): void {
    const { data, width, height } = imageData;

    // 透明を背景色でフラット化して色ズレを抑える
    const flattened = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 255;
      const alpha = a / 255;
      flattened[i] = Math.round(
        r * alpha + this.backgroundColor.r * (1 - alpha),
      );
      flattened[i + 1] = Math.round(
        g * alpha + this.backgroundColor.g * (1 - alpha),
      );
      flattened[i + 2] = Math.round(
        b * alpha + this.backgroundColor.b * (1 - alpha),
      );
      flattened[i + 3] = 255;
    }

    const palette = quantize(flattened, 256, {
      format: "rgb565",
    });
    const index = applyPalette(flattened, palette, "rgb565");

    this.encoder.writeFrame(index, width, height, {
      palette,
      delay: this.delayMs,
      transparent: false,
    });
  }

  async finish(): Promise<Blob> {
    this.encoder.finish();
    const bytes = this.encoder.bytes();
    return new Blob([bytes], { type: "image/gif" });
  }
}
