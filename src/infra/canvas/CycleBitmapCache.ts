import type { StrokeChangeTracker } from "./StrokeChangeTracker";
import type { FrameKey } from "./types";

type CycleState = {
  key: FrameKey | null;
  cacheKey: string | null;
  renderCacheEpoch: number | null;
  inFlight: Promise<ImageBitmap> | null;
  inFlightKey: FrameKey | null;
  tracker: StrokeChangeTracker;
};

type LruEntry = {
  bitmap: ImageBitmap;
  cycleIndex: number;
};

/**
 * cycle単位のImageBitmapキャッシュ（LRU）、in-flight Promise、差分トラッカーを保持する。
 * LRUのキーは drawingId / renderCacheEpoch / jitter / cycleIndex。
 */
export class CycleBitmapCache {
  private states: CycleState[];
  /** cacheKey -> ImageBitmap のLRU（事前生成せず、使った分だけ保持する） */
  private lru = new Map<string, LruEntry>();
  /** LRUに保持するImageBitmapの最大件数 */
  private maxEntries: number;

  constructor({
    cycleCount,
    createTracker,
    maxEntries,
  }: {
    cycleCount: number;
    createTracker: () => StrokeChangeTracker;
    maxEntries: number;
  }) {
    this.maxEntries = maxEntries;
    this.states = Array.from({ length: cycleCount }, () => ({
      key: null,
      cacheKey: null,
      renderCacheEpoch: null,
      inFlight: null,
      inFlightKey: null,
      tracker: createTracker(),
    }));
  }

  getBitmap({
    key,
    cacheKey,
    renderCacheEpoch,
  }: {
    key: FrameKey;
    cacheKey: string;
    renderCacheEpoch: number;
  }): ImageBitmap | null {
    const state = this.getState({ cycleIndex: key.cycleIndex });
    if (
      state.renderCacheEpoch !== null &&
      state.renderCacheEpoch !== renderCacheEpoch
    ) {
      return null;
    }
    const cached = this.getLruBitmap({ cacheKey });
    if (!cached) return null;
    state.key = key;
    state.cacheKey = cacheKey;
    state.renderCacheEpoch = renderCacheEpoch;
    return cached;
  }

  getBaseBitmap({
    cycleIndex,
    renderCacheEpoch,
  }: {
    cycleIndex: number;
    renderCacheEpoch: number;
  }): ImageBitmap | null {
    const state = this.getState({ cycleIndex });
    if (!state.cacheKey) return null;
    if (state.renderCacheEpoch !== renderCacheEpoch) return null;
    return this.getLruBitmap({ cacheKey: state.cacheKey });
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
    cacheKey,
    renderCacheEpoch,
    bitmap,
  }: {
    key: FrameKey;
    cacheKey: string;
    renderCacheEpoch: number;
    bitmap: ImageBitmap;
  }): boolean {
    const state = this.getState({ cycleIndex: key.cycleIndex });
    if (state.key && state.key.drawingRevision > key.drawingRevision) {
      return false;
    }
    this.setLruBitmap({
      cacheKey,
      cycleIndex: key.cycleIndex,
      bitmap,
    });
    state.key = key;
    state.cacheKey = cacheKey;
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
    this.clearLru();
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
    this.clearLruByCycleIndex({ cycleIndex });
  }

  private resetState({ state }: { state: CycleState }): void {
    state.key = null;
    state.cacheKey = null;
    state.renderCacheEpoch = null;
    state.inFlight = null;
    state.inFlightKey = null;
    state.tracker.reset();
  }

  private getLruBitmap({ cacheKey }: { cacheKey: string }): ImageBitmap | null {
    const entry = this.lru.get(cacheKey);
    if (!entry) return null;
    this.lru.delete(cacheKey);
    this.lru.set(cacheKey, entry);
    return entry.bitmap;
  }

  private setLruBitmap({
    cacheKey,
    cycleIndex,
    bitmap,
  }: {
    cacheKey: string;
    cycleIndex: number;
    bitmap: ImageBitmap;
  }): void {
    const existing = this.lru.get(cacheKey);
    if (existing) {
      existing.bitmap.close();
    }
    this.lru.delete(cacheKey);
    this.lru.set(cacheKey, { bitmap, cycleIndex });

    while (this.lru.size > this.maxEntries) {
      const oldestKeyResult = this.lru.keys().next();
      if (oldestKeyResult.done) break;
      const oldestKey = oldestKeyResult.value;
      const oldest = this.lru.get(oldestKey);
      if (oldest) {
        oldest.bitmap.close();
      }
      this.lru.delete(oldestKey);
    }
  }

  private clearLru(): void {
    for (const entry of this.lru.values()) {
      entry.bitmap.close();
    }
    this.lru.clear();
  }

  private clearLruByCycleIndex({ cycleIndex }: { cycleIndex: number }): void {
    for (const [key, entry] of this.lru) {
      if (entry.cycleIndex !== cycleIndex) continue;
      entry.bitmap.close();
      this.lru.delete(key);
    }
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
