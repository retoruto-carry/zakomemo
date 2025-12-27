import type { JitterConfig } from "@/core/jitter";
import type { Drawing, Stroke } from "@/core/types";
import type {
  DrawingRenderer,
  RafScheduler,
  StrokeSound,
  StrokeSoundInfo,
  TimeProvider,
} from "@/engine/ports";
import { WigglyEngine } from "@/engine/WigglyEngine";

export const DEFAULT_TEST_DRAWING: Drawing = {
  width: 50,
  height: 50,
  strokes: [],
};

export const DEFAULT_TEST_JITTER_AMPLITUDE = 1.5;
export const DEFAULT_TEST_JITTER_FREQUENCY = 0.01;
export const DEFAULT_TEST_JITTER_CONFIG: JitterConfig = {
  amplitude: DEFAULT_TEST_JITTER_AMPLITUDE,
  frequency: DEFAULT_TEST_JITTER_FREQUENCY,
};

export class MockRenderer implements DrawingRenderer {
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

  renderStroke({
    stroke,
    jitteredPoints,
    elapsedTimeMs,
  }: {
    stroke: Stroke;
    jitteredPoints: { x: number; y: number }[];
    elapsedTimeMs: number;
  }): void {
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

export class MockTime implements TimeProvider {
  private current = 0;
  now(): number {
    return this.current;
  }
  set(ms: number) {
    this.current = ms;
  }
}

export class MockRaf implements RafScheduler {
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

export class MockSound implements StrokeSound {
  events: Array<{ type: string; info: StrokeSoundInfo }> = [];
  destroyed = false;
  onStrokeStart(info: StrokeSoundInfo): void {
    this.events.push({ type: "start", info });
  }
  onStrokeUpdate(info: StrokeSoundInfo): void {
    this.events.push({ type: "update", info });
  }
  onStrokeEnd(info: StrokeSoundInfo): void {
    this.events.push({ type: "end", info });
  }
  destroy(): void {
    this.destroyed = true;
  }
}

export function createTestEngine(): {
  engine: WigglyEngine;
  time: MockTime;
  raf: MockRaf;
  renderer: MockRenderer;
  sound: MockSound;
};
export function createTestEngine<
  TRenderer extends DrawingRenderer,
  TTime extends TimeProvider,
  TRaf extends RafScheduler,
  TSound extends StrokeSound,
>(options: {
  initialDrawing?: Drawing;
  renderer: TRenderer;
  time: TTime;
  raf: TRaf;
  sound: TSound;
  jitterConfig?: JitterConfig;
}): {
  engine: WigglyEngine;
  time: TTime;
  raf: TRaf;
  renderer: TRenderer;
  sound: TSound;
};
export function createTestEngine<
  TRenderer extends DrawingRenderer,
  TTime extends TimeProvider,
  TRaf extends RafScheduler,
  TSound extends StrokeSound,
>({
  initialDrawing = DEFAULT_TEST_DRAWING,
  renderer,
  time,
  raf,
  sound,
  jitterConfig = DEFAULT_TEST_JITTER_CONFIG,
}: {
  initialDrawing?: Drawing;
  renderer?: TRenderer;
  time?: TTime;
  raf?: TRaf;
  sound?: TSound;
  jitterConfig?: JitterConfig;
} = {}): {
  engine: WigglyEngine;
  time: TTime | MockTime;
  raf: TRaf | MockRaf;
  renderer: TRenderer | MockRenderer;
  sound: TSound | MockSound;
} {
  const resolvedTime = time ?? new MockTime();
  const resolvedRaf = raf ?? new MockRaf();
  const resolvedRenderer =
    renderer ?? new MockRenderer(initialDrawing.width, initialDrawing.height);
  const resolvedSound = sound ?? new MockSound();

  const engine = new WigglyEngine({
    initialDrawing,
    renderer: resolvedRenderer,
    time: resolvedTime,
    raf: resolvedRaf,
    sound: resolvedSound,
    jitterConfig,
  });

  return {
    engine,
    time: resolvedTime,
    raf: resolvedRaf,
    renderer: resolvedRenderer,
    sound: resolvedSound,
  };
}
