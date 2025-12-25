import { describe, expect, test, vi } from "vitest";
import type { Drawing, Stroke } from "../../core/types";
import { CycleBitmapCache } from "./CycleBitmapCache";
import { StrokeChangeTracker } from "./StrokeChangeTracker";

function createBitmapMock(): ImageBitmap {
  return {
    width: 100,
    height: 100,
    close: vi.fn(),
  } as ImageBitmap;
}

function createStroke(
  id: string,
  points: Array<{ x: number; y: number; t: number }>,
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

function createDrawing(strokes: Stroke[]): Drawing {
  return {
    width: 100,
    height: 100,
    strokes,
  };
}

describe("CycleBitmapCache", () => {
  test("commitしたbitmapを取得できる", () => {
    const cache = new CycleBitmapCache({
      cycleCount: 3,
      createTracker: () => new StrokeChangeTracker(),
    });
    const key = { drawingRevision: 1, jitterKey: "j", cycleIndex: 0 };
    const bitmap = createBitmapMock();

    cache.commit({ key, renderCacheEpoch: 1, bitmap });

    expect(cache.getBitmap({ key, renderCacheEpoch: 1 })).toBe(bitmap);
  });

  test("renderCacheEpochが一致しない場合は取得できない", () => {
    const cache = new CycleBitmapCache({
      cycleCount: 3,
      createTracker: () => new StrokeChangeTracker(),
    });
    const key = { drawingRevision: 1, jitterKey: "j", cycleIndex: 0 };
    const bitmap = createBitmapMock();

    cache.commit({ key, renderCacheEpoch: 1, bitmap });

    expect(cache.getBitmap({ key, renderCacheEpoch: 2 })).toBeNull();
  });

  test("in-flightは同じkeyで再利用される", () => {
    const cache = new CycleBitmapCache({
      cycleCount: 3,
      createTracker: () => new StrokeChangeTracker(),
    });
    const key = { drawingRevision: 1, jitterKey: "j", cycleIndex: 0 };
    const promise = Promise.resolve(createBitmapMock());

    cache.setInFlight({ key, promise });

    expect(cache.getInFlight({ key })).toBe(promise);
    expect(
      cache.getInFlight({
        key: { drawingRevision: 2, jitterKey: "j", cycleIndex: 0 },
      }),
    ).toBeNull();
  });

  test("resetAllでbitmapが破棄される", () => {
    const cache = new CycleBitmapCache({
      cycleCount: 3,
      createTracker: () => new StrokeChangeTracker(),
    });
    const key = { drawingRevision: 1, jitterKey: "j", cycleIndex: 0 };
    const bitmap = createBitmapMock();

    cache.commit({ key, renderCacheEpoch: 1, bitmap });
    cache.resetAll();

    expect(bitmap.close).toHaveBeenCalled();
    expect(cache.getBitmap({ key, renderCacheEpoch: 1 })).toBeNull();
  });

  test("古いdrawingRevisionのcommitは採用されない", () => {
    const cache = new CycleBitmapCache({
      cycleCount: 3,
      createTracker: () => new StrokeChangeTracker(),
    });
    const latestKey = { drawingRevision: 2, jitterKey: "j", cycleIndex: 0 };
    const latestBitmap = createBitmapMock();
    cache.commit({ key: latestKey, renderCacheEpoch: 1, bitmap: latestBitmap });

    const olderKey = { drawingRevision: 1, jitterKey: "j", cycleIndex: 0 };
    const olderBitmap = createBitmapMock();
    const committed = cache.commit({
      key: olderKey,
      renderCacheEpoch: 1,
      bitmap: olderBitmap,
    });

    expect(committed).toBe(false);
    expect(cache.getBitmap({ key: latestKey, renderCacheEpoch: 1 })).toBe(
      latestBitmap,
    );
  });

  test("resetCycleでtrackerが初期化される", () => {
    const cache = new CycleBitmapCache({
      cycleCount: 3,
      createTracker: () => new StrokeChangeTracker(),
    });
    const drawing = createDrawing([createStroke("s1", [{ x: 1, y: 1, t: 0 }])]);
    const tracker = cache.getTracker({ cycleIndex: 0 });
    tracker.sync({ drawing });

    cache.resetCycle({ cycleIndex: 0 });

    const diff = cache.getTracker({ cycleIndex: 0 }).diff({ drawing });
    expect(diff.mode).toBe("scratch");
  });
});
