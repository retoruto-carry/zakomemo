import type { Drawing } from "../core/types";
import type { JitterConfig } from "../core/jitter";
import { renderDrawingAtTime } from "./frameRenderer";
import type { DrawingRenderer, GifEncoder } from "./ports";

type RendererWithImageData = DrawingRenderer & {
  getImageData?: () => ImageData;
};

export async function exportDrawingAsGif(options: {
  drawing: Drawing;
  renderer: RendererWithImageData;
  gif: GifEncoder;
  jitterConfig: JitterConfig;
  fps: number;
  durationMs: number;
}): Promise<Blob> {
  const { drawing, renderer, gif, jitterConfig, fps, durationMs } = options;
  const frameInterval = 1000 / fps;
  const frameCount = Math.ceil(durationMs / frameInterval);

  gif.begin(drawing.width, drawing.height, fps);

  for (let i = 0; i < frameCount; i += 1) {
    const timeMs = i * frameInterval;
    renderDrawingAtTime(drawing, renderer, jitterConfig, timeMs);
    const imageData = renderer.getImageData?.();
    if (!imageData) {
      throw new Error("DrawingRenderer must provide getImageData for GIF export");
    }
    gif.addFrame(imageData);
  }

  return gif.finish();
}
