import type { StrokeChangeTracker } from "./StrokeChangeTracker";
import type { FrameKey } from "./types";

type CycleState = {
  bitmap: ImageBitmap | null;
  key: FrameKey | null;
  renderCacheEpoch: number | null;
  inFlight: Promise<ImageBitmap> | null;
  inFlightKey: FrameKey | null;
  tracker: StrokeChangeTracker;
};

/**
 * cycle単位のImageBitmapキャッシュ、in-flight Promise、差分トラッカーを保持する。
 * キャッシュキーは drawingRevision / jitter / cycleIndex。
 */
export class CycleBitmapCache {
  private states: CycleState[];

  constructor({
    cycleCount,
    createTracker,
  }: {
    cycleCount: number;
    createTracker: () => StrokeChangeTracker;
  }) {
    this.states = Array.from({ length: cycleCount }, () => ({
      bitmap: null,
      key: null,
      renderCacheEpoch: null,
      inFlight: null,
      inFlightKey: null,
      tracker: createTracker(),
    }));
  }

  getBitmap({
    key,
    renderCacheEpoch,
  }: {
    key: FrameKey;
    renderCacheEpoch: number;
  }): ImageBitmap | null {
    const state = this.getState({ cycleIndex: key.cycleIndex });
    if (!state.bitmap || !state.key) return null;
    if (!isSameKey({ left: state.key, right: key })) return null;
    if (state.renderCacheEpoch !== renderCacheEpoch) return null;
    return state.bitmap;
  }

  getBaseBitmap({
    cycleIndex,
    renderCacheEpoch,
  }: {
    cycleIndex: number;
    renderCacheEpoch: number;
  }): ImageBitmap | null {
    const state = this.getState({ cycleIndex });
    if (!state.bitmap) return null;
    if (state.renderCacheEpoch !== renderCacheEpoch) return null;
    return state.bitmap;
  }

  getInFlight({ key }: { key: FrameKey }): Promise<ImageBitmap> | null {
    const state = this.getState({ cycleIndex: key.cycleIndex });
    if (!state.inFlight || !state.inFlightKey) return null;
    if (!isSameKey({ left: state.inFlightKey, right: key })) return null;
    return state.inFlight;
  }

  setInFlight({
    key,
    promise,
  }: {
    key: FrameKey;
    promise: Promise<ImageBitmap>;
  }): void {
    const state = this.getState({ cycleIndex: key.cycleIndex });
    state.inFlight = promise;
    state.inFlightKey = key;
  }

  clearInFlight({ cycleIndex }: { cycleIndex: number }): void {
    const state = this.getState({ cycleIndex });
    state.inFlight = null;
    state.inFlightKey = null;
  }

  commit({
    key,
    renderCacheEpoch,
    bitmap,
  }: {
    key: FrameKey;
    renderCacheEpoch: number;
    bitmap: ImageBitmap;
  }): boolean {
    const state = this.getState({ cycleIndex: key.cycleIndex });
    if (state.key && state.key.drawingRevision > key.drawingRevision) {
      return false;
    }
    if (state.bitmap) {
      state.bitmap.close();
    }
    state.bitmap = bitmap;
    state.key = key;
    state.renderCacheEpoch = renderCacheEpoch;
    state.inFlight = null;
    state.inFlightKey = null;
    return true;
  }

  getTracker({ cycleIndex }: { cycleIndex: number }): StrokeChangeTracker {
    return this.getState({ cycleIndex }).tracker;
  }

  /** すべてのcycleのキャッシュ状態を破棄する */
  resetAll(): void {
    for (const state of this.states) {
      this.resetState({ state });
    }
  }

  private getState({ cycleIndex }: { cycleIndex: number }): CycleState {
    const state = this.states[cycleIndex];
    if (!state) {
      throw new Error(`cycleIndex out of range: ${cycleIndex}`);
    }
    return state;
  }

  resetCycle({ cycleIndex }: { cycleIndex: number }): void {
    const state = this.getState({ cycleIndex });
    this.resetState({ state });
  }

  private resetState({ state }: { state: CycleState }): void {
    if (state.bitmap) {
      state.bitmap.close();
    }
    state.bitmap = null;
    state.key = null;
    state.renderCacheEpoch = null;
    state.inFlight = null;
    state.inFlightKey = null;
    state.tracker.reset();
  }
}

function isSameKey({
  left,
  right,
}: {
  left: FrameKey;
  right: FrameKey;
}): boolean {
  return (
    left.cycleIndex === right.cycleIndex &&
    left.drawingRevision === right.drawingRevision &&
    left.jitterKey === right.jitterKey
  );
}
