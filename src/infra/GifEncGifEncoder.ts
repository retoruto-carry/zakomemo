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
    const palette = quantize(data, 256, { format: "rgba4444", oneBitAlpha: true });
    const index = applyPalette(data, palette, "rgba4444");

    this.encoder.writeFrame(index, width, height, {
      palette,
      delay: this.delayMs,
      transparent: true,
    });
  }

  async finish(): Promise<Blob> {
    this.encoder.finish();
    const bytes = this.encoder.bytes();
    return new Blob([bytes], { type: "image/gif" });
  }
}
