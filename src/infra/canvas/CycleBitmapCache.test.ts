import { describe, expect, test, vi } from "vitest";
import { CycleBitmapCache } from "./CycleBitmapCache";
import { StrokeChangeTracker } from "./StrokeChangeTracker";

function createBitmapMock(): ImageBitmap {
  return {
    width: 100,
    height: 100,
    close: vi.fn(),
  } as ImageBitmap;
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
});
