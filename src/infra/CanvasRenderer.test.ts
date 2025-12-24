import { beforeEach, describe, expect, test } from "vitest";
import type { JitterConfig } from "../core/jitter";
import type { Drawing, Stroke } from "../core/types";
import { CanvasRenderer } from "./CanvasRenderer";

/**
 * テスト用のヘルパー関数
 */
function createTestCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  return canvas;
}

function createTestDrawing(strokes: Stroke[] = []): Drawing {
  return {
    width: 100,
    height: 100,
    strokes,
  };
}

function createTestStroke(
  id: string,
  points: Array<{ x: number; y: number; t: number }> = [{ x: 10, y: 10, t: 0 }],
): Stroke {
  return {
    id,
    kind: "draw",
    brush: {
      kind: "solid",
      color: "#000000",
      width: 2,
      opacity: 1,
    },
    points,
  };
}

const defaultJitterConfig: JitterConfig = {
  amplitude: 1.0,
  frequency: 0.008,
};

describe("CanvasRenderer キャッシュ", () => {
  let canvas: HTMLCanvasElement;
  let renderer: CanvasRenderer;

  beforeEach(() => {
    // createImageBitmapをモック
    if (typeof globalThis.createImageBitmap === "undefined") {
      globalThis.createImageBitmap = async (
        source: ImageBitmapSource,
      ): Promise<ImageBitmap> => {
        if (source instanceof HTMLCanvasElement) {
          // モックのImageBitmapを作成
          const bitmap = {
            width: source.width,
            height: source.height,
            close: () => {},
          } as ImageBitmap;
          return bitmap;
        }
        throw new Error("Unsupported source type");
      };
    }

    canvas = createTestCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    renderer = new CanvasRenderer({
      ctx,
      backgroundColor: "#ffffff",
    });
    renderer.clear(100, 100);
  });

  describe("初回描画（キャッシュなし）", () => {
    test("初回描画時はキャッシュがなく、新規生成される", async () => {
      const drawing = createTestDrawing([createTestStroke("s1")]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      expect(bitmap1).toBeDefined();
      expect(bitmap1.width).toBe(100);
      expect(bitmap1.height).toBe(100);
    });

    test("同じフレームを再度取得すると、キャッシュから返される", async () => {
      const drawing = createTestDrawing([createTestStroke("s1")]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 同じフレームを再度取得
      const bitmap2 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 同じImageBitmapインスタンスが返される（キャッシュヒット）
      expect(bitmap2).toBe(bitmap1);
    });
  });

  describe("新しいストローク追加（差分描画）", () => {
    test("新しいストロークを追加すると、差分描画が行われる", async () => {
      const drawing1 = createTestDrawing([createTestStroke("s1")]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing: drawing1,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 新しいストロークを追加
      const drawing2 = createTestDrawing([
        createTestStroke("s1"),
        createTestStroke("s2"),
      ]);
      const bitmap2 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 新しいImageBitmapが生成される（差分描画）
      expect(bitmap2).not.toBe(bitmap1);
      expect(bitmap2.width).toBe(100);
      expect(bitmap2.height).toBe(100);
    });

    test("新しいストローク追加後、同じフレームを再度取得するとキャッシュから返される", async () => {
      const drawing1 = createTestDrawing([createTestStroke("s1")]);
      await renderer.getFrameBitmap({
        drawing: drawing1,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 新しいストロークを追加
      const drawing2 = createTestDrawing([
        createTestStroke("s1"),
        createTestStroke("s2"),
      ]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 同じフレームを再度取得
      const bitmap2 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // キャッシュから返される
      expect(bitmap2).toBe(bitmap1);
    });
  });

  describe("既存のストロークにポイント追加（ポイント単位の差分描画）", () => {
    test("既存のストロークにポイントを追加すると、新しいポイントだけが描画される", async () => {
      const drawing1 = createTestDrawing([
        createTestStroke("s1", [
          { x: 10, y: 10, t: 0 },
          { x: 20, y: 20, t: 10 },
        ]),
      ]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing: drawing1,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 既存のストロークにポイントを追加
      const drawing2 = createTestDrawing([
        createTestStroke("s1", [
          { x: 10, y: 10, t: 0 },
          { x: 20, y: 20, t: 10 },
          { x: 30, y: 30, t: 20 },
        ]),
      ]);
      const bitmap2 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 新しいImageBitmapが生成される（ポイント単位の差分描画）
      expect(bitmap2).not.toBe(bitmap1);
    });

    test("ポイント追加後、同じフレームを再度取得するとキャッシュから返される", async () => {
      const drawing1 = createTestDrawing([
        createTestStroke("s1", [
          { x: 10, y: 10, t: 0 },
          { x: 20, y: 20, t: 10 },
        ]),
      ]);
      await renderer.getFrameBitmap({
        drawing: drawing1,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 既存のストロークにポイントを追加
      const drawing2 = createTestDrawing([
        createTestStroke("s1", [
          { x: 10, y: 10, t: 0 },
          { x: 20, y: 20, t: 10 },
          { x: 30, y: 30, t: 20 },
        ]),
      ]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 同じフレームを再度取得
      const bitmap2 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // キャッシュから返される
      expect(bitmap2).toBe(bitmap1);
    });
  });

  describe("背景色変更（キャッシュ無効化）", () => {
    test("背景色を変更すると、キャッシュが無効化される", async () => {
      const drawing = createTestDrawing([createTestStroke("s1")]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 背景色を変更
      renderer.setBackgroundColor("#000000");

      // 同じフレームを再度取得
      const bitmap2 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 新しいImageBitmapが生成される（キャッシュが無効化されたため）
      expect(bitmap2).not.toBe(bitmap1);
    });
  });

  describe("jitterConfig変更（キャッシュ無効化）", () => {
    test("jitterConfigを変更すると、キャッシュが無効化される", async () => {
      const drawing = createTestDrawing([createTestStroke("s1")]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // jitterConfigを変更
      const newJitterConfig: JitterConfig = {
        amplitude: 2.0,
        frequency: 0.01,
      };

      // 同じフレームを再度取得
      const bitmap2 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: newJitterConfig,
        elapsedTimeMs: 0,
      });

      // 新しいImageBitmapが生成される（キャッシュが無効化されたため）
      expect(bitmap2).not.toBe(bitmap1);
    });

    test("同じjitterConfigの場合は、キャッシュが有効", async () => {
      const drawing = createTestDrawing([createTestStroke("s1")]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 同じjitterConfigで再度取得
      const bitmap2 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // キャッシュから返される
      expect(bitmap2).toBe(bitmap1);
    });
  });

  describe("全消し（キャッシュ無効化）", () => {
    test("全消しすると、キャッシュが無効化される", async () => {
      const drawing1 = createTestDrawing([createTestStroke("s1")]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing: drawing1,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 全消し
      const drawing2 = createTestDrawing([]);
      const bitmap2 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 新しいImageBitmapが生成される（全再生成）
      expect(bitmap2).not.toBe(bitmap1);
    });
  });

  describe("複数フレームの生成", () => {
    test("3フレームすべてが生成される", async () => {
      const drawing = createTestDrawing([createTestStroke("s1")]);

      // フレーム0を取得
      const bitmap0 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // フレーム1を取得
      const bitmap1 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 1,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 100,
      });

      // フレーム2を取得
      const bitmap2 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 2,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 200,
      });

      // すべてのフレームが生成される
      expect(bitmap0).toBeDefined();
      expect(bitmap1).toBeDefined();
      expect(bitmap2).toBeDefined();

      // 各フレームは異なるImageBitmap
      expect(bitmap0).not.toBe(bitmap1);
      expect(bitmap1).not.toBe(bitmap2);
      expect(bitmap0).not.toBe(bitmap2);
    });

    test("同じフレームを再度取得すると、キャッシュから返される", async () => {
      const drawing = createTestDrawing([createTestStroke("s1")]);

      const bitmap1 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      const bitmap2 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // キャッシュから返される
      expect(bitmap2).toBe(bitmap1);
    });
  });

  describe("バックグラウンド生成（非同期フレーム生成）", () => {
    test("要求されたフレームは同期的に生成され、他のフレームは非同期で生成される", async () => {
      const drawing = createTestDrawing([createTestStroke("s1")]);

      // フレーム0を取得（同期的に生成される）
      const bitmap0 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      expect(bitmap0).toBeDefined();

      // バックグラウンドで他のフレームが生成されるまで少し待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // フレーム1を取得（バックグラウンドで生成されている可能性がある）
      const bitmap1 = await renderer.getFrameBitmap({
        drawing,
        frameIndex: 1,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 100,
      });

      expect(bitmap1).toBeDefined();
    });
  });

  describe("複合シナリオ", () => {
    test("ストローク追加 → ポイント追加 → 同じフレーム取得", async () => {
      // 初回描画
      const drawing1 = createTestDrawing([
        createTestStroke("s1", [
          { x: 10, y: 10, t: 0 },
          { x: 20, y: 20, t: 10 },
        ]),
      ]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing: drawing1,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 新しいストロークを追加
      const drawing2 = createTestDrawing([
        createTestStroke("s1", [
          { x: 10, y: 10, t: 0 },
          { x: 20, y: 20, t: 10 },
        ]),
        createTestStroke("s2", [{ x: 30, y: 30, t: 0 }]),
      ]);
      const bitmap2 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });
      expect(bitmap2).not.toBe(bitmap1);

      // 既存のストロークにポイントを追加
      const drawing3 = createTestDrawing([
        createTestStroke("s1", [
          { x: 10, y: 10, t: 0 },
          { x: 20, y: 20, t: 10 },
          { x: 25, y: 25, t: 15 },
        ]),
        createTestStroke("s2", [{ x: 30, y: 30, t: 0 }]),
      ]);
      const bitmap3 = await renderer.getFrameBitmap({
        drawing: drawing3,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });
      expect(bitmap3).not.toBe(bitmap2);

      // 同じフレームを再度取得（キャッシュから返される）
      const bitmap4 = await renderer.getFrameBitmap({
        drawing: drawing3,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });
      expect(bitmap4).toBe(bitmap3);
    });

    test("背景色変更 → ストローク追加 → jitterConfig変更", async () => {
      const drawing1 = createTestDrawing([createTestStroke("s1")]);
      const bitmap1 = await renderer.getFrameBitmap({
        drawing: drawing1,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });

      // 背景色を変更
      renderer.setBackgroundColor("#000000");
      const bitmap2 = await renderer.getFrameBitmap({
        drawing: drawing1,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });
      expect(bitmap2).not.toBe(bitmap1);

      // 新しいストロークを追加
      const drawing2 = createTestDrawing([
        createTestStroke("s1"),
        createTestStroke("s2"),
      ]);
      const bitmap3 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: defaultJitterConfig,
        elapsedTimeMs: 0,
      });
      expect(bitmap3).not.toBe(bitmap2);

      // jitterConfigを変更
      const newJitterConfig: JitterConfig = {
        amplitude: 2.0,
        frequency: 0.01,
      };
      const bitmap4 = await renderer.getFrameBitmap({
        drawing: drawing2,
        frameIndex: 0,
        jitterConfig: newJitterConfig,
        elapsedTimeMs: 0,
      });
      expect(bitmap4).not.toBe(bitmap3);
    });
  });
});
