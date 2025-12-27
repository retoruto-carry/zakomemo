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

/** エンジンテスト向けの最小描画フィクスチャ。 */
export const DEFAULT_TEST_DRAWING: Drawing = {
  width: 50,
  height: 50,
  strokes: [],
};

/** エンジンテストで使うデフォルトのジッター振幅。 */
export const DEFAULT_TEST_JITTER_AMPLITUDE = 1.5;
/** エンジンテストで使うデフォルトのジッター周波数。 */
export const DEFAULT_TEST_JITTER_FREQUENCY = 0.01;
/** エンジンテストで使うデフォルトのジッター設定。 */
export const DEFAULT_TEST_JITTER_CONFIG: JitterConfig = {
  amplitude: DEFAULT_TEST_JITTER_AMPLITUDE,
  frequency: DEFAULT_TEST_JITTER_FREQUENCY,
};

/** 描画内容を記録するレンダラーモック。 */
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

  /** 描画バッファをクリアした記録を残す。 */
  clear(width: number, height: number): void {
    this.clears.push({ width, height });
  }

  /** テスト用の空実装。 */
  invalidateRenderCache(): void {
    // モック用の空実装
  }

  /** ストローク描画の引数を記録する。 */
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

  /** 疑似ImageDataを返す。 */
  getImageData(): ImageData {
    return this.imageData;
  }
}

/** 手動で時間を進められるタイムモック。 */
export class MockTime implements TimeProvider {
  private current = 0;
  /** 現在時刻を返す。 */
  now(): number {
    return this.current;
  }
  /** 現在時刻を設定する。 */
  set(ms: number) {
    this.current = ms;
  }
}

/** キューを任意タイミングで実行できるRAFモック。 */
export class MockRaf implements RafScheduler {
  private lastId = 0;
  private callbacks = new Map<number, () => void>();
  /** コールバックを登録してIDを返す。 */
  request(cb: () => void): number {
    this.lastId += 1;
    this.callbacks.set(this.lastId, cb);
    return this.lastId;
  }
  /** 指定IDのコールバックをキャンセルする。 */
  cancel(id: number): void {
    this.callbacks.delete(id);
  }
  /** 指定IDまたは最新IDのコールバックを実行する。 */
  runFrame(id?: number): void {
    const targetId = id ?? this.lastId;
    const cb = this.callbacks.get(targetId);
    cb?.();
  }
}

/** ストローク音のライフサイクルを記録するモック。 */
export class MockSound implements StrokeSound {
  events: Array<{ type: string; info: StrokeSoundInfo }> = [];
  destroyed = false;
  /** 開始イベントを記録する。 */
  onStrokeStart(info: StrokeSoundInfo): void {
    this.events.push({ type: "start", info });
  }
  /** 更新イベントを記録する。 */
  onStrokeUpdate(info: StrokeSoundInfo): void {
    this.events.push({ type: "update", info });
  }
  /** 終了イベントを記録する。 */
  onStrokeEnd(info: StrokeSoundInfo): void {
    this.events.push({ type: "end", info });
  }
  /** 破棄済みフラグを立てる。 */
  destroy(): void {
    this.destroyed = true;
  }
}

/** デフォルトモックでWigglyEngineを生成する。 */
export function createTestEngine(): {
  engine: WigglyEngine;
  time: MockTime;
  raf: MockRaf;
  renderer: MockRenderer;
  sound: MockSound;
};
/** すべてのモックを指定してWigglyEngineを生成する。 */
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
/** createTestEngineの実装。 */
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
