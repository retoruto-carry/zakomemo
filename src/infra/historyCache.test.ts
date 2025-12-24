import {
  clearHistoryCache,
  evictOldEntries,
  getFromHistoryCache,
  type HistoryCache,
  type HistoryCacheEntry,
  saveAndEvict,
  saveToHistoryCache,
} from "./historyCache";

describe("historyCache", () => {
  describe("getFromHistoryCache", () => {
    it("存在するエントリを取得できる", () => {
      const cache: HistoryCache = new Map();
      const entry: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: Date.now(),
      };
      cache.set("hash1", entry);

      const result = getFromHistoryCache(cache, "hash1");
      expect(result).toEqual(entry);
    });

    it("存在しないエントリはnullを返す", () => {
      const cache: HistoryCache = new Map();
      const result = getFromHistoryCache(cache, "hash1");
      expect(result).toBeNull();
    });
  });

  describe("saveToHistoryCache", () => {
    it("エントリを保存できる", () => {
      const cache: HistoryCache = new Map();
      const entry: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: Date.now(),
      };

      saveToHistoryCache(cache, "hash1", entry);

      expect(cache.get("hash1")).toEqual(entry);
    });

    it("既存のエントリを上書きできる", () => {
      const cache: HistoryCache = new Map();
      const entry1: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: Date.now(),
      };
      const entry2: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 2.0, frequency: 0.01 },
        timestamp: Date.now() + 1000,
      };

      saveToHistoryCache(cache, "hash1", entry1);
      saveToHistoryCache(cache, "hash1", entry2);

      expect(cache.get("hash1")).toEqual(entry2);
    });
  });

  describe("evictOldEntries", () => {
    it("最大サイズ以下の場合は何も削除しない", () => {
      const cache: HistoryCache = new Map();
      const entry1: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 1000,
      };
      const entry2: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 2000,
      };

      cache.set("hash1", entry1);
      cache.set("hash2", entry2);

      const removed = evictOldEntries(cache, 5);

      expect(removed).toEqual([]);
      expect(cache.size).toBe(2);
    });

    it("最大サイズを超える場合、古いエントリを削除する", () => {
      const cache: HistoryCache = new Map();
      const entries: HistoryCacheEntry[] = [];
      for (let i = 0; i < 10; i++) {
        const entry: HistoryCacheEntry = {
          frameBitmaps: [null, null, null],
          jitterConfig: { amplitude: 1.2, frequency: 0.008 },
          timestamp: i * 1000,
        };
        entries.push(entry);
        cache.set(`hash${i}`, entry);
      }

      const removed = evictOldEntries(cache, 5);

      expect(removed.length).toBe(5);
      expect(cache.size).toBe(5);
      // 古いエントリが削除されている
      expect(cache.has("hash0")).toBe(false);
      expect(cache.has("hash1")).toBe(false);
      expect(cache.has("hash2")).toBe(false);
      expect(cache.has("hash3")).toBe(false);
      expect(cache.has("hash4")).toBe(false);
      // 新しいエントリが残っている
      expect(cache.has("hash5")).toBe(true);
      expect(cache.has("hash9")).toBe(true);
    });

    it("同じタイムスタンプの場合は、先に追加されたものが削除される", () => {
      const cache: HistoryCache = new Map();
      const entry1: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 1000,
      };
      const entry2: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 1000, // 同じタイムスタンプ
      };
      const entry3: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 1000, // 同じタイムスタンプ
      };

      cache.set("hash1", entry1);
      cache.set("hash2", entry2);
      cache.set("hash3", entry3);

      const removed = evictOldEntries(cache, 2);

      expect(removed.length).toBe(1);
      expect(cache.size).toBe(2);
      // Mapの挿入順序に基づいて削除される（実装依存だが、テストで確認）
      expect(removed).toContainEqual(entry1);
    });
  });

  describe("clearHistoryCache", () => {
    it("空のキャッシュの場合は空配列を返す", () => {
      const cache: HistoryCache = new Map();
      const removed = clearHistoryCache(cache);
      expect(removed).toEqual([]);
      expect(cache.size).toBe(0);
    });

    it("すべてのエントリをクリアする", () => {
      const cache: HistoryCache = new Map();
      const entry1: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 1000,
      };
      const entry2: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 2000,
      };

      cache.set("hash1", entry1);
      cache.set("hash2", entry2);

      const removed = clearHistoryCache(cache);

      expect(removed.length).toBe(2);
      expect(cache.size).toBe(0);
    });
  });

  describe("saveAndEvict", () => {
    it("エントリを保存し、古いエントリを削除する", () => {
      const cache: HistoryCache = new Map();
      const entries: HistoryCacheEntry[] = [];
      for (let i = 0; i < 5; i++) {
        const entry: HistoryCacheEntry = {
          frameBitmaps: [null, null, null],
          jitterConfig: { amplitude: 1.2, frequency: 0.008 },
          timestamp: i * 1000,
        };
        entries.push(entry);
        cache.set(`hash${i}`, entry);
      }

      const newEntry: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 2.0, frequency: 0.01 },
        timestamp: 5000,
      };

      const removed = saveAndEvict(cache, "hash5", newEntry, 5);

      expect(cache.size).toBe(5);
      expect(cache.get("hash5")).toEqual(newEntry);
      // 古いエントリ（hash0）が削除されている
      expect(cache.has("hash0")).toBe(false);
      expect(removed.length).toBe(1);
    });

    it("既存のエントリを上書きする場合、そのエントリも削除対象に含める", () => {
      const cache: HistoryCache = new Map();
      const entry1: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 1000,
      };
      const entry2: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 1.2, frequency: 0.008 },
        timestamp: 2000,
      };

      cache.set("hash1", entry1);
      cache.set("hash2", entry2);

      const newEntry: HistoryCacheEntry = {
        frameBitmaps: [null, null, null],
        jitterConfig: { amplitude: 2.0, frequency: 0.01 },
        timestamp: 3000,
      };

      const removed = saveAndEvict(cache, "hash1", newEntry, 5);

      expect(cache.size).toBe(2);
      expect(cache.get("hash1")).toEqual(newEntry);
      // 既存のエントリ（entry1）が削除対象に含まれている
      expect(removed).toContainEqual(entry1);
    });
  });
});
