import * as renderScheduler from "@/engine/renderScheduler";
import { WigglyEngine } from "@/engine/WigglyEngine";
import {
  createTestEngine,
  DEFAULT_TEST_DRAWING,
  MockRaf,
  MockRenderer,
  MockTime,
} from "@/testUtils/engineMocks";

const initialDrawing = DEFAULT_TEST_DRAWING;

describe("WigglyEngine", () => {
  test("ポインタ操作でストロークを作成し履歴に記録する", () => {
    const { engine, time, sound } = createTestEngine();

    time.set(0);
    engine.pointerDown(5, 5);
    time.set(10);
    engine.pointerMove(8, 9); // dist 5
    time.set(20);
    engine.pointerUp();

    const drawing = engine.getDrawing();
    expect(drawing.strokes).toHaveLength(1);
    expect(drawing.strokes[0].points).toHaveLength(2);

    const updateEvent = sound.events.find((e) => e.type === "update");
    expect(updateEvent?.info.length).toBeCloseTo(5);
    expect(updateEvent?.info.speed).toBeGreaterThan(0);
  });

  test("undo/redoで履歴を移動できる", () => {
    const { engine, time } = createTestEngine();
    engine.pointerDown(0, 0);
    time.set(5);
    engine.pointerMove(3, 4);
    engine.pointerUp();

    engine.undo();
    expect(engine.getDrawing().strokes).toHaveLength(0);

    engine.redo();
    expect(engine.getDrawing().strokes).toHaveLength(1);
  });

  test("clearは履歴に追加されundoできる", () => {
    const { engine, time } = createTestEngine();
    engine.pointerDown(1, 1);
    time.set(5);
    engine.pointerMove(2, 2);
    engine.pointerUp();

    engine.clear();
    expect(engine.getDrawing().strokes).toHaveLength(0);

    engine.undo();
    expect(engine.getDrawing().strokes).toHaveLength(1);
  });

  test("レンダリングループでジッター適用済みポイントが描画される", () => {
    const { engine, time, raf, renderer } = createTestEngine();
    engine.pointerDown(0, 0);
    time.set(5);
    engine.pointerMove(10, 0);
    engine.pointerUp();

    time.set(100);
    raf.runFrame();

    expect(renderer.clears).toHaveLength(1);
    expect(renderer.rendered).toHaveLength(1);
    const { jittered } = renderer.rendered[0];
    expect(jittered[0].x).not.toBe(0);
  });

  test("背景色変更でキャッシュと保留中リクエストを無効化する", () => {
    class MockRendererWithBackground extends MockRenderer {
      setBackgroundColor = vi.fn();
    }

    const time = new MockTime();
    const raf = new MockRaf();
    const renderer = new MockRendererWithBackground(
      initialDrawing.width,
      initialDrawing.height,
    );
    const engine = new WigglyEngine({
      initialDrawing,
      renderer,
      time,
      raf,
      jitterConfig: { amplitude: 0, frequency: 1 },
    });
    const invalidateSpy = vi.spyOn(renderScheduler, "invalidateRendererCache");

    engine.setBackgroundColor("#000000");

    expect(renderer.setBackgroundColor).toHaveBeenCalledWith("#000000");
    expect(invalidateSpy).toHaveBeenCalledWith(renderer);

    engine.destroy();
    invalidateSpy.mockRestore();
  });

  test("パレット変更でレンダラーとキャッシュを同期する", () => {
    class MockRendererWithPalette extends MockRenderer {
      setPaletteColors = vi.fn();
    }

    const time = new MockTime();
    const raf = new MockRaf();
    const renderer = new MockRendererWithPalette(
      initialDrawing.width,
      initialDrawing.height,
    );
    const engine = new WigglyEngine({
      initialDrawing,
      renderer,
      time,
      raf,
      jitterConfig: { amplitude: 0, frequency: 1 },
    });
    const invalidateSpy = vi.spyOn(renderScheduler, "invalidateRendererCache");
    const cacheSpy = vi.spyOn(renderer, "invalidateRenderCache");

    const palette = ["#000000", "#ffffff"];
    engine.setPaletteColors(palette);

    expect(renderer.setPaletteColors).toHaveBeenCalledWith(palette);
    expect(cacheSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith(renderer);

    engine.destroy();
    invalidateSpy.mockRestore();
  });

  test("destroyでRAFループをキャンセルする", () => {
    const { engine, raf } = createTestEngine();
    const cancelSpy = vi.spyOn(raf, "cancel");
    engine.destroy();
    expect(cancelSpy).toHaveBeenCalled();
  });

  test("destroyでサウンドの後片付けを呼び出す", () => {
    const { engine, sound } = createTestEngine();
    engine.destroy();
    expect(sound.destroyed).toBe(true);
  });

  test("座標は整数にスナップされる", () => {
    const { engine, time } = createTestEngine();
    time.set(0);
    engine.pointerDown(10.7, 20.3);
    const drawing = engine.getDrawing();
    const point = drawing.strokes[0].points[0];
    expect(Number.isInteger(point.x)).toBe(true);
    expect(Number.isInteger(point.y)).toBe(true);
    expect(point.x).toBe(11);
    expect(point.y).toBe(20);
  });

  test("ブラシサイズは整数にスナップされる", () => {
    const { engine } = createTestEngine();
    engine.setBrushWidth(10.7);
    engine.pointerDown(0, 0);
    const drawing = engine.getDrawing();
    expect(Number.isInteger(drawing.strokes[0].brush.width)).toBe(true);
    expect(drawing.strokes[0].brush.width).toBe(11);
  });

  test("小数座標の移動も整数にスナップされる", () => {
    const { engine, time } = createTestEngine();
    time.set(0);
    engine.pointerDown(0, 0);
    time.set(10);
    engine.pointerMove(10.6, 20.4);
    const drawing = engine.getDrawing();
    const lastPoint =
      drawing.strokes[0].points[drawing.strokes[0].points.length - 1];
    expect(Number.isInteger(lastPoint.x)).toBe(true);
    expect(Number.isInteger(lastPoint.y)).toBe(true);
    expect(lastPoint.x).toBe(11);
    expect(lastPoint.y).toBe(20);
  });

  describe("統合テスト（描画フロー全体）", () => {
    test("pointerDown → pointerMove → pointerUp → undo → redo の完全なフロー", () => {
      const { engine, time } = createTestEngine();

      // 1. 描画開始
      time.set(0);
      engine.pointerDown(10, 10);
      let drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(1);
      expect(drawing.strokes[0].points).toHaveLength(1);

      // 2. ポイント追加（複数回）
      time.set(10);
      engine.pointerMove(20, 20);
      time.set(20);
      engine.pointerMove(30, 30);
      drawing = engine.getDrawing();
      expect(drawing.strokes[0].points.length).toBeGreaterThan(1);

      // 3. 描画終了
      time.set(30);
      engine.pointerUp();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(1);

      // 4. やり直し
      engine.undo();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(0);

      // 5. 進む
      engine.redo();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(1);
    });

    test("複数のストロークを描画 → undo → redo → clear のフロー", () => {
      const { engine, time } = createTestEngine();

      // 1. 最初のストローク
      time.set(0);
      engine.pointerDown(0, 0);
      time.set(10);
      engine.pointerMove(10, 10);
      engine.pointerUp();

      // 2. 2番目のストローク
      time.set(20);
      engine.pointerDown(20, 20);
      time.set(30);
      engine.pointerMove(30, 30);
      engine.pointerUp();

      let drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(2);

      // 3. やり直し（2番目のストロークが削除される）
      engine.undo();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(1);

      // 4. 進む（2番目のストロークが復元される）
      engine.redo();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(2);

      // 5. clear（すべてのストロークが削除される）
      engine.clear();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(0);

      // 6. やり直し（全消しが取り消される）
      engine.undo();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(2);
    });

    test("描画 → 背景色変更 → undo → redo のフロー", () => {
      const { engine, time } = createTestEngine();

      // 1. 描画
      time.set(0);
      engine.pointerDown(0, 0);
      time.set(10);
      engine.pointerMove(10, 10);
      engine.pointerUp();

      // 2. 背景色変更
      engine.setBackgroundColor("#000000");
      // 背景色変更は履歴に影響しないため、ストロークは残る
      let drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(1);

      // 3. やり直し（描画が取り消される）
      engine.undo();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(0);

      // 4. 進む（描画が復元される）
      engine.redo();
      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(1);
    });
  });

  describe("境界値", () => {
    test("非常に多くのストローク", () => {
      const { engine, time } = createTestEngine();

      // 100個のストロークを描画
      for (let i = 0; i < 100; i++) {
        time.set(i * 10);
        engine.pointerDown(i, i);
        time.set(i * 10 + 5);
        engine.pointerMove(i + 1, i + 1);
        engine.pointerUp();
      }

      const drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(100);
    });

    test("非常に長いストローク（多数のポイント）", () => {
      const { engine, time } = createTestEngine();

      time.set(0);
      engine.pointerDown(0, 0);

      // 1000個のポイントを追加
      for (let i = 1; i <= 1000; i++) {
        time.set(i * 10);
        engine.pointerMove(i, i);
      }

      engine.pointerUp();

      const drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(1);
      expect(drawing.strokes[0].points.length).toBeGreaterThan(100);
    });

    test("連続したundo/redo", () => {
      const { engine, time } = createTestEngine();

      // 5個のストロークを描画
      for (let i = 0; i < 5; i++) {
        time.set(i * 10);
        engine.pointerDown(i, i);
        time.set(i * 10 + 5);
        engine.pointerMove(i + 1, i + 1);
        engine.pointerUp();
      }

      // やり直しを5回
      for (let i = 0; i < 5; i++) {
        engine.undo();
      }

      let drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(0);

      // 進むを5回
      for (let i = 0; i < 5; i++) {
        engine.redo();
      }

      drawing = engine.getDrawing();
      expect(drawing.strokes).toHaveLength(5);
    });
  });
});
