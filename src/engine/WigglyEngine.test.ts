import { WigglyEngine } from "./WigglyEngine";
import type { Drawing, Stroke } from "../core/types";
import type {
  DrawingRenderer,
  RafScheduler,
  StrokeSound,
  StrokeSoundInfo,
  TimeProvider,
} from "./ports";

class MockRenderer implements DrawingRenderer {
  clears: { width: number; height: number }[] = [];
  rendered: Array<{ stroke: Stroke; jittered: { x: number; y: number }[]; time: number }> =
    [];
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

  renderStroke(
    stroke: Stroke,
    jitteredPoints: { x: number; y: number }[],
    timeMs: number
  ): void {
    this.rendered.push({ stroke, jittered: jitteredPoints, time: timeMs });
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
  const renderer = new MockRenderer(initialDrawing.width, initialDrawing.height);
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
});
