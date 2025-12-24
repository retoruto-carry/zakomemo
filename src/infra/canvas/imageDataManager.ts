/**
 * ImageData管理ユーティリティ
 * ImageDataの初期化とピクセル操作を提供
 */

export interface ImageDataContext {
  lastWidth: number;
  lastHeight: number;
  backgroundColorRgba: { r: number; g: number; b: number; a: number };
  imageData: ImageData | null;
  data: Uint8ClampedArray | null;
  offscreenCanvas: HTMLCanvasElement | null;
  offscreenCtx: CanvasRenderingContext2D | null;
}

/**
 * ImageDataを初期化（背景色で塗りつぶす）
 * オフスクリーンCanvasも初期化（スケールアップ用）
 */
export function initializeImageData(
  context: ImageDataContext,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.imageData = ctx.createImageData(width, height);
  context.data = context.imageData.data;
  const bg = context.backgroundColorRgba;

  // 背景色で塗りつぶす
  for (let i = 0; i < context.data.length; i += 4) {
    context.data[i] = bg.r; // R
    context.data[i + 1] = bg.g; // G
    context.data[i + 2] = bg.b; // B
    context.data[i + 3] = bg.a * 255; // A (0-255)
  }

  // オフスクリーンCanvasを初期化（スケールアップ用）
  const dpr = window.devicePixelRatio || 1;
  context.offscreenCanvas = document.createElement("canvas");
  context.offscreenCanvas.width = width * dpr;
  context.offscreenCanvas.height = height * dpr;
  context.offscreenCtx = context.offscreenCanvas.getContext("2d");
  if (context.offscreenCtx) {
    context.offscreenCtx.imageSmoothingEnabled = false;
  }
}

/**
 * ImageDataの指定座標にRGBA値を設定
 */
export function setPixel(
  context: ImageDataContext,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (
    !context.data ||
    x < 0 ||
    y < 0 ||
    x >= context.lastWidth ||
    y >= context.lastHeight
  ) {
    return;
  }

  const index = (y * context.lastWidth + x) * 4;
  context.data[index] = r; // R
  context.data[index + 1] = g; // G
  context.data[index + 2] = b; // B
  context.data[index + 3] = a; // A
}
