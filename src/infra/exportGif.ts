import type { JitterConfig } from "@/core/jitter";
import type { Drawing } from "@/core/types";
import type {
  DrawingRenderer,
  GetCycleBitmapParams,
  GifEncoder,
} from "@/engine/ports";
import { CYCLE_COUNT, CYCLE_INTERVAL_MS } from "@/engine/renderingConstants";
import { renderDrawingAtTime } from "@/engine/renderScheduler";

type RendererWithImageData = DrawingRenderer & {
  getImageData: () => ImageData;
};

type RendererWithCycleBitmap = DrawingRenderer & {
  getCycleBitmap(params: GetCycleBitmapParams): Promise<ImageBitmap>;
  getCycleCount(): number;
};

export type ExportGifOptions = {
  /** 描画データ */
  drawing: Drawing;
  /** Drawingの版番号（キャッシュ無効化用） */
  drawingRevision: number;
  /** 描画レンダラー */
  renderer: RendererWithImageData | RendererWithCycleBitmap;
  /** GIFエンコーダー */
  gif: GifEncoder;
  /** jitter設定 */
  jitterConfig: JitterConfig;
};

/**
 * DrawingをGIFに変換して返す。
 * ImageBitmapキャッシュ対応レンダラーの場合はキャッシュ経由で描画する。
 *
 * @throws レンダラーがgetImageDataメソッドを提供していない場合
 */
export async function exportDrawingAsGif(
  options: ExportGifOptions,
): Promise<Blob> {
  const { drawing, drawingRevision, renderer, gif, jitterConfig } = options;
  const fps = Math.round(1000 / CYCLE_INTERVAL_MS);

  gif.begin(drawing.width, drawing.height, fps);

  // 1サイクル分だけ出力する

  // ImageBitmapキャッシュを使用する場合
  if (
    "getCycleBitmap" in renderer &&
    typeof renderer.getCycleBitmap === "function" &&
    "getCycleCount" in renderer &&
    typeof renderer.getCycleCount === "function"
  ) {
    const cycleRenderer = renderer as RendererWithCycleBitmap;
    const cycleCount = cycleRenderer.getCycleCount();
    const totalFrames = cycleCount;

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
      const elapsedTimeMs = i * CYCLE_INTERVAL_MS;

      const bitmap = await cycleRenderer.getCycleBitmap({
        drawing,
        drawingRevision,
        cycleIndex: i,
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
    // フォールバック: 通常の描画（1サイクル分）
    const totalFrames = CYCLE_COUNT;
    const imageRenderer = renderer as RendererWithImageData;

    for (let i = 0; i < totalFrames; i += 1) {
      const elapsedTimeMs = i * CYCLE_INTERVAL_MS;
      renderDrawingAtTime({
        drawing,
        drawingRevision,
        renderer,
        jitterConfig,
        elapsedTimeMs,
      });
      const imageData = imageRenderer.getImageData();
      gif.addFrame(imageData);
    }
  }

  return gif.finish();
}
