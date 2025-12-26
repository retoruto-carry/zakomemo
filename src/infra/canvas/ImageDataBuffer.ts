import { parseColorToRgb } from "@/infra/colorUtil";

/** ImageDataBufferの初期化オプション */
export type ImageDataBufferOptions = {
  ctx: CanvasRenderingContext2D;
  backgroundColor: string;
};

/** 1ピクセル書き込みの入力 */
export type SetPixelParams = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
};

/**
 * ピクセル描画用のImageDataとオフスクリーンキャンバスのラッパー。
 * 背景の塗りつぶしとバッファからのImageBitmap生成を扱う。
 */
export class ImageDataBuffer {
  private ctx: CanvasRenderingContext2D;
  private backgroundColorRgba: { r: number; g: number; b: number; a: number };
  private lastWidth = 0;
  private lastHeight = 0;
  private imageData: ImageData | null = null;
  private data: Uint8ClampedArray | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  /** バッファを初期化する */
  constructor({ ctx, backgroundColor }: ImageDataBufferOptions) {
    this.ctx = ctx;
    this.backgroundColorRgba = parseColorToRgb(backgroundColor);
  }

  /** 背景色を更新し、初期化済みならバッファを再塗りつぶしする */
  setBackgroundColor({ backgroundColor }: { backgroundColor: string }): void {
    this.backgroundColorRgba = parseColorToRgb(backgroundColor);
    if (this.imageData) {
      this.clear({ width: this.lastWidth, height: this.lastHeight });
    }
  }

  /** 背景色のRGBAを取得する */
  getBackgroundColorRgba(): { r: number; g: number; b: number; a: number } {
    return this.backgroundColorRgba;
  }

  /** 現在のバッファサイズを取得する */
  getSize(): { width: number; height: number } {
    return { width: this.lastWidth, height: this.lastHeight };
  }

  /** ImageDataが初期化済みかどうか */
  hasImageData(): boolean {
    return this.imageData !== null && this.data !== null;
  }

  /** バッファサイズを保証し、再初期化した場合はtrueを返す */
  ensureSize({ width, height }: { width: number; height: number }): boolean {
    if (
      this.imageData &&
      this.lastWidth === width &&
      this.lastHeight === height
    ) {
      return false;
    }
    this.clear({ width, height });
    return true;
  }

  /** バッファを指定サイズで初期化する */
  clear({ width, height }: { width: number; height: number }): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.initializeImageData({ width, height });
  }

  /** 現在のImageDataバッファに1ピクセル書き込む */
  setPixel({ x, y, r, g, b, a }: SetPixelParams): void {
    if (
      !this.data ||
      x < 0 ||
      y < 0 ||
      x >= this.lastWidth ||
      y >= this.lastHeight
    ) {
      return;
    }

    const index = (y * this.lastWidth + x) * 4;
    this.data[index] = r;
    this.data[index + 1] = g;
    this.data[index + 2] = b;
    this.data[index + 3] = a;
  }

  /** ImageBitmapからImageDataを読み込む */
  loadFromBitmap({
    bitmap,
    width,
    height,
  }: {
    bitmap: ImageBitmap;
    width: number;
    height: number;
  }): void {
    this.ensureSize({ width, height });
    if (!this.offscreenCanvas || !this.offscreenCtx) {
      throw new Error("Offscreen canvas is not initialized.");
    }

    this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.offscreenCtx.clearRect(0, 0, width, height);
    this.offscreenCtx.drawImage(bitmap, 0, 0, width, height);
    const imageData = this.offscreenCtx.getImageData(0, 0, width, height);
    this.imageData = imageData;
    this.data = imageData.data;
  }

  /** 現在のImageDataを取得する */
  getImageData(): ImageData {
    if (!this.imageData) {
      throw new Error("ImageData is not initialized. Call clear() first.");
    }
    return this.imageData;
  }

  /** オフスクリーンキャンバスを取得する */
  getOffscreenCanvas(): HTMLCanvasElement {
    if (!this.offscreenCanvas) {
      throw new Error("Offscreen canvas is not initialized.");
    }
    return this.offscreenCanvas;
  }

  /** 現在のImageDataをオフスクリーンキャンバスに反映する */
  putToOffscreen(): void {
    if (!this.imageData || !this.offscreenCanvas || !this.offscreenCtx) {
      throw new Error("Offscreen canvas is not initialized.");
    }
    this.offscreenCtx.putImageData(this.imageData, 0, 0);
  }

  /** オフスクリーンキャンバスからImageBitmapを生成する */
  async createBitmap(): Promise<ImageBitmap> {
    if (!this.offscreenCanvas) {
      throw new Error("Offscreen canvas is not initialized.");
    }
    this.putToOffscreen();
    return await createImageBitmap(this.offscreenCanvas);
  }

  /** ImageDataとオフスクリーンを初期化する */
  private initializeImageData({
    width,
    height,
  }: {
    width: number;
    height: number;
  }): void {
    this.imageData = this.ctx.createImageData(width, height);
    this.data = this.imageData.data;
    const bg = this.backgroundColorRgba;

    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = bg.r;
      this.data[i + 1] = bg.g;
      this.data[i + 2] = bg.b;
      this.data[i + 3] = bg.a * 255;
    }

    if (!this.offscreenCanvas) {
      // 初期化コストを抑えるため、オフスクリーンは再利用する
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
        willReadFrequently: true,
      });
    }

    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    if (this.offscreenCtx) {
      // サイズ変更でリセットされるため毎回設定する
      this.offscreenCtx.imageSmoothingEnabled = false;
    }
  }
}
