import type { JitterConfig } from "../core/jitter";
import type { Drawing } from "../core/types";
import { renderDrawingAtTime } from "./frameRenderer";
import type { DrawingRenderer, GifEncoder } from "./ports";
import { CYCLE_INTERVAL_MS } from "./renderingConstants";

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
  const { drawing, renderer, gif, jitterConfig, fps, durationMs } = options;

  gif.begin(drawing.width, drawing.height, fps);

  // ImageBitmapキャッシュを使用する場合
  if (
    "getCycleBitmap" in renderer &&
    typeof renderer.getCycleBitmap === "function" &&
    "getCycleCount" in renderer &&
    typeof renderer.getCycleCount === "function"
  ) {
    const cycleCount = renderer.getCycleCount();
    // durationMsに基づいて必要なフレーム数を計算
    const frameInterval = 1000 / fps;
    const totalFrames = Math.ceil(durationMs / frameInterval);

    // cycleCount分のアニメーションをループさせる
    // アニメーション速度: 10fps（100ms/フレーム）で固定
    const jitterFrameInterval = CYCLE_INTERVAL_MS;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = drawing.width;
    tempCanvas.height = drawing.height;
    const tempCtx = tempCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!tempCtx) {
      throw new Error("Failed to get 2D context for temp canvas");
    }

    for (let i = 0; i < totalFrames; i += 1) {
      const elapsedTimeMs = i * frameInterval;
      // cycleCountの中から適切なフレームを選択
      const cycleIndex = Math.floor(
        (elapsedTimeMs / jitterFrameInterval) % cycleCount,
      );

      const bitmap = await renderer.getCycleBitmap({
        drawing,
        drawingRevision: 0,
        cycleIndex,
        jitterConfig,
        elapsedTimeMs,
      });

      try {
        // ImageBitmapからImageDataを取得
        tempCtx.setTransform(1, 0, 0, 1, 0, 0);
        tempCtx.clearRect(0, 0, drawing.width, drawing.height);
        tempCtx.drawImage(bitmap, 0, 0);
        const imageData = tempCtx.getImageData(
          0,
          0,
          drawing.width,
          drawing.height,
        );
        gif.addFrame(imageData);
      } finally {
        bitmap.close();
      }
    }
  } else {
    // フォールバック: 通常の描画
    const frameInterval = 1000 / fps;
    const totalFrames = Math.ceil(durationMs / frameInterval);

    for (let i = 0; i < totalFrames; i += 1) {
      const elapsedTimeMs = i * frameInterval;
      renderDrawingAtTime({
        drawing,
        drawingRevision: 0,
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
