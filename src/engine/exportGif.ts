import type { JitterConfig } from "../core/jitter";
import type { Drawing } from "../core/types";
import { FRAME_COUNT, renderDrawingAtTime } from "./frameRenderer";
import type { DrawingRenderer, GifEncoder } from "./ports";

type RendererWithImageData = DrawingRenderer & {
  getImageData?: () => ImageData;
};

/**
 * @throws レンダラーがgetImageDataメソッドを提供していない場合
 */
export async function exportDrawingAsGif(options: {
  drawing: Drawing;
  renderer: RendererWithImageData;
  gif: GifEncoder;
  jitterConfig: JitterConfig;
  fps: number;
  durationMs: number;
}): Promise<Blob> {
  const { drawing, renderer, gif, jitterConfig, fps } = options;

  // 3フレーム固定
  const frameInterval = 1000 / (jitterConfig.frequency * FRAME_COUNT);

  gif.begin(drawing.width, drawing.height, fps);

  // ImageBitmapキャッシュを使用する場合
  if (
    "getFrameBitmap" in renderer &&
    typeof renderer.getFrameBitmap === "function" &&
    "getFrameCount" in renderer &&
    typeof renderer.getFrameCount === "function"
  ) {
    const frameCount = renderer.getFrameCount();
    for (let i = 0; i < frameCount; i++) {
      const frameElapsedTimeMs = i * frameInterval;
      const bitmap = await renderer.getFrameBitmap({
        drawing,
        frameIndex: i,
        jitterConfig,
        elapsedTimeMs: frameElapsedTimeMs,
      });

      // ImageBitmapからImageDataを取得
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = drawing.width;
      tempCanvas.height = drawing.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) {
        throw new Error("Failed to get 2D context for temp canvas");
      }
      tempCtx.drawImage(bitmap, 0, 0);
      const imageData = tempCtx.getImageData(
        0,
        0,
        drawing.width,
        drawing.height,
      );
      gif.addFrame(imageData);
    }
  } else {
    // フォールバック: 通常の描画
    const frameInterval = 1000 / fps;
    const frameCount = Math.ceil(options.durationMs / frameInterval);

    for (let i = 0; i < frameCount; i += 1) {
      const elapsedTimeMs = i * frameInterval;
      renderDrawingAtTime({
        drawing,
        renderer,
        jitterConfig,
        elapsedTimeMs,
      });
      const imageData = renderer.getImageData?.();
      if (!imageData) {
        throw new Error(
          "DrawingRenderer must provide getImageData for GIF export",
        );
      }
      gif.addFrame(imageData);
    }
  }

  return gif.finish();
}
