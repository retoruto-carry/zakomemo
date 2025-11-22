import { applyPalette, GIFEncoder, quantize } from "gifenc";
import type { GifEncoder } from "@/engine/ports";

export class GifEncGifEncoder implements GifEncoder {
  private encoder = GIFEncoder();
  private delayMs = 0;

  begin(width: number, height: number, fps: number): void {
    this.delayMs = Math.round(1000 / fps);
    // gifenc writes header automatically on first frame in auto mode
    // but we can prime encoder if needed; storing dimensions for clarity
    void width;
    void height;
  }

  addFrame(imageData: ImageData): void {
    const { data, width, height } = imageData;

    // 透明を白でフラット化して色ズレを抑える
    const flattened = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 255;
      const alpha = a / 255;
      flattened[i] = Math.round(r * alpha + 255 * (1 - alpha));
      flattened[i + 1] = Math.round(g * alpha + 255 * (1 - alpha));
      flattened[i + 2] = Math.round(b * alpha + 255 * (1 - alpha));
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
