import { parseColorToRgb } from "../colorUtil";

export type ImageDataBufferOptions = {
  ctx: CanvasRenderingContext2D;
  backgroundColor: string;
};

export type SetPixelParams = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
};

export class ImageDataBuffer {
  private ctx: CanvasRenderingContext2D;
  private backgroundColorRgba: { r: number; g: number; b: number; a: number };
  private lastWidth = 0;
  private lastHeight = 0;
  private imageData: ImageData | null = null;
  private data: Uint8ClampedArray | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  constructor({ ctx, backgroundColor }: ImageDataBufferOptions) {
    this.ctx = ctx;
    this.backgroundColorRgba = parseColorToRgb(backgroundColor);
  }

  setBackgroundColor({ backgroundColor }: { backgroundColor: string }): void {
    this.backgroundColorRgba = parseColorToRgb(backgroundColor);
    if (this.imageData) {
      this.clear({ width: this.lastWidth, height: this.lastHeight });
    }
  }

  getBackgroundColorRgba(): { r: number; g: number; b: number; a: number } {
    return this.backgroundColorRgba;
  }

  getSize(): { width: number; height: number } {
    return { width: this.lastWidth, height: this.lastHeight };
  }

  hasImageData(): boolean {
    return this.imageData !== null && this.data !== null;
  }

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

  clear({ width, height }: { width: number; height: number }): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.initializeImageData({ width, height });
  }

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

  getImageData(): ImageData {
    if (!this.imageData) {
      throw new Error("ImageData is not initialized. Call clear() first.");
    }
    return this.imageData;
  }

  getOffscreenCanvas(): HTMLCanvasElement {
    if (!this.offscreenCanvas) {
      throw new Error("Offscreen canvas is not initialized.");
    }
    return this.offscreenCanvas;
  }

  putToOffscreen(): void {
    if (!this.imageData || !this.offscreenCanvas || !this.offscreenCtx) {
      throw new Error("Offscreen canvas is not initialized.");
    }
    this.offscreenCtx.putImageData(this.imageData, 0, 0);
  }

  async createBitmap(): Promise<ImageBitmap> {
    if (!this.offscreenCanvas) {
      throw new Error("Offscreen canvas is not initialized.");
    }
    this.putToOffscreen();
    return await createImageBitmap(this.offscreenCanvas);
  }

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

    const dpr = window.devicePixelRatio || 1;
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = width * dpr;
    this.offscreenCanvas.height = height * dpr;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (this.offscreenCtx) {
      this.offscreenCtx.imageSmoothingEnabled = false;
    }
  }
}
