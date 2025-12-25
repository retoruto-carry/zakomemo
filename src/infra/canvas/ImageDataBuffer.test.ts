import { describe, expect, test, vi } from "vitest";
import { ImageDataBuffer } from "./ImageDataBuffer";

function createBuffer(backgroundColor: string): ImageDataBuffer {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D context is not available");
  }
  return new ImageDataBuffer({ ctx, backgroundColor });
}

function getPixel(
  buffer: ImageDataBuffer,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const data = buffer.getImageData().data;
  const { width } = buffer.getSize();
  const index = (y * width + x) * 4;
  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
    a: data[index + 3] ?? 0,
  };
}

describe("ImageDataBuffer", () => {
  test("ensureSize initializes once and skips when size matches", () => {
    const buffer = createBuffer("#112233");

    const first = buffer.ensureSize({ width: 2, height: 2 });
    const second = buffer.ensureSize({ width: 2, height: 2 });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  test("clear fills the buffer with background color", () => {
    const buffer = createBuffer("#112233");

    buffer.clear({ width: 1, height: 1 });

    expect(getPixel(buffer, 0, 0)).toEqual({
      r: 17,
      g: 34,
      b: 51,
      a: 255,
    });
  });

  test("setPixel writes within bounds and ignores out-of-bounds", () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 2, height: 2 });

    buffer.setPixel({ x: 1, y: 1, r: 1, g: 2, b: 3, a: 4 });
    buffer.setPixel({ x: -1, y: 0, r: 9, g: 9, b: 9, a: 9 });

    expect(getPixel(buffer, 1, 1)).toEqual({
      r: 1,
      g: 2,
      b: 3,
      a: 4,
    });
    expect(getPixel(buffer, 0, 0)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    });
  });

  test("createBitmap delegates to createImageBitmap", async () => {
    const buffer = createBuffer("#ffffff");
    buffer.clear({ width: 2, height: 2 });

    const original = globalThis.createImageBitmap;
    const createSpy = vi.fn(async () => {
      return { width: 2, height: 2, close: () => {} } as ImageBitmap;
    });
    globalThis.createImageBitmap = createSpy;

    try {
      const bitmap = await buffer.createBitmap();
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(bitmap.width).toBe(2);
      expect(bitmap.height).toBe(2);
    } finally {
      globalThis.createImageBitmap = original;
    }
  });
});
