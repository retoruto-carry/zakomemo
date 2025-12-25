import type { Drawing, Stroke } from "../core/types";
import type {
  DrawingRenderer,
  RafScheduler,
  StrokeSound,
  StrokeSoundInfo,
  TimeProvider,
} from "./ports";
import { WigglyEngine } from "./WigglyEngine";

class MockRenderer implements DrawingRenderer {
  clears: { width: number; height: number }[] = [];
  rendered: Array<{
    stroke: Stroke;
    jittered: { x: number; y: number }[];
    time: number;
  }> = [];
  imageData: ImageData;

  constructor(width: number, height: number) {
    this.imageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    } as unknown as ImageData;
  }

  clear(width: number, height: number): void {
    this.clears.push({ width, height });
  }

  invalidateRenderCache(): void {
    // モック用の空実装
  }

  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    elapsedTimeMs: number,
  ): void {
    this.rendered.push({
      stroke,
      jittered: jitteredPoints,
      time: elapsedTimeMs,
    });
  }

  getImageData(): ImageData {
    return this.imageData;
  }
}

class MockTime implements TimeProvider {
  private current = 0;
  now(): number {
    return this.current;
  }
  set(ms: number) {
    this.current = ms;
  }
}

class MockRaf implements RafScheduler {
  private lastId = 0;
  private callbacks = new Map<number, () => void>();
  request(cb: () => void): number {
    this.lastId += 1;
    this.callbacks.set(this.lastId, cb);
    return this.lastId;
  }
  cancel(id: number): void {
    this.callbacks.delete(id);
  }
  runFrame(id?: number): void {
    const targetId = id ?? this.lastId;
    const cb = this.callbacks.get(targetId);
    cb?.();
  }
}

class MockSound implements StrokeSound {
  events: Array<{ type: string; info: StrokeSoundInfo }> = [];
  onStrokeStart(info: StrokeSoundInfo): void {
    this.events.push({ type: "start", info });
  }
  onStrokeUpdate(info: StrokeSoundInfo): void {
    this.events.push({ type: "update", info });
  }
  onStrokeEnd(info: StrokeSoundInfo): void {
    this.events.push({ type: "end", info });
  }
}

const initialDrawing: Drawing = {
  width: 50,
  height: 50,
  strokes: [],
};

function createEngine() {
  const time = new MockTime();
  const raf = new MockRaf();
  const renderer = new MockRenderer(
    initialDrawing.width,
    initialDrawing.height,
  );
  const sound = new MockSound();

  const engine = new WigglyEngine({
    initialDrawing,
    renderer,
    time,
    raf,
    sound,
    jitterConfig: { amplitude: 1.5, frequency: 0.01 },
  });

  return { engine, time, raf, renderer, sound };
}

describe("WigglyEngine", () => {
  test("pointer lifecycle creates stroke and records history", () => {
    const { engine, time, sound } = createEngine();

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

  test("undo and redo navigate history", () => {
    const { engine, time } = createEngine();
    engine.pointerDown(0, 0);
    time.set(5);
    engine.pointerMove(3, 4);
    engine.pointerUp();

    engine.undo();
    expect(engine.getDrawing().strokes).toHaveLength(0);

    engine.redo();
    expect(engine.getDrawing().strokes).toHaveLength(1);
  });

  test("clear pushes a new history entry that can be undone", () => {
    const { engine, time } = createEngine();
    engine.pointerDown(1, 1);
    time.set(5);
    engine.pointerMove(2, 2);
    engine.pointerUp();

    engine.clear();
    expect(engine.getDrawing().strokes).toHaveLength(0);

    engine.undo();
    expect(engine.getDrawing().strokes).toHaveLength(1);
  });

  test("render loop triggers renderer with jittered points", () => {
    const { engine, time, raf, renderer } = createEngine();
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

  test("destroy cancels RAF loop", () => {
    const { engine, raf } = createEngine();
    const cancelSpy = vi.spyOn(raf, "cancel");
    engine.destroy();
    expect(cancelSpy).toHaveBeenCalled();
  });

  test("座標は整数にスナップされる", () => {
    const { engine, time } = createEngine();
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
    const { engine } = createEngine();
    engine.setBrushWidth(10.7);
    engine.pointerDown(0, 0);
    const drawing = engine.getDrawing();
    expect(Number.isInteger(drawing.strokes[0].brush.width)).toBe(true);
    expect(drawing.strokes[0].brush.width).toBe(11);
  });

  test("小数座標の移動も整数にスナップされる", () => {
    const { engine, time } = createEngine();
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
      const { engine, time } = createEngine();

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
      const { engine, time } = createEngine();

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
      const { engine, time } = createEngine();

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
      const { engine, time } = createEngine();

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
      const { engine, time } = createEngine();

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
      const { engine, time } = createEngine();

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
