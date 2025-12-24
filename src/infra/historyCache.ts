/**
 * 履歴キャッシュの管理（関数型アプローチ）
 * 既存の`core/history.ts`と一貫性を保つため、純粋関数として実装
 */

import type { JitterConfig } from "../core/jitter";

/**
 * 履歴キャッシュエントリ
 */
export type HistoryCacheEntry = {
  frameBitmaps: (ImageBitmap | null)[];
  jitterConfig: JitterConfig;
  timestamp: number;
};

/**
 * 履歴キャッシュ（キー: drawingHash, 値: HistoryCacheEntry）
 */
export type HistoryCache = Map<string, HistoryCacheEntry>;

/**
 * 履歴キャッシュの最大サイズ
 */
export const MAX_HISTORY_CACHE_SIZE = 5;

/**
 * 履歴キャッシュからエントリを取得
 * @param cache 履歴キャッシュ
 * @param hash drawingHash
 * @returns エントリ（存在しない場合はnull）
 */
export function getFromHistoryCache(
  cache: HistoryCache,
  hash: string,
): HistoryCacheEntry | null {
  return cache.get(hash) ?? null;
}

/**
 * 履歴キャッシュにエントリを保存
 * 既存のエントリがある場合は上書き（呼び出し側で`close()`を呼ぶ必要がある）
 *
 * 注意: この関数はImageBitmapの参照をそのまま保存する。
 * ImageBitmapのクローンが必要な場合は、呼び出し側で適切にクローンしてから
 * この関数を呼び出すこと。現在の実装では、`CanvasRenderer.saveToHistoryCache`
 * で参照を共有している（暫定実装）。将来的には適切なクローン実装が必要。
 *
 * @param cache 履歴キャッシュ
 * @param hash drawingHash
 * @param entry エントリ
 * @returns 新しい履歴キャッシュ（イミュータブルな操作のため、同じMapを返す）
 */
export function saveToHistoryCache(
  cache: HistoryCache,
  hash: string,
  entry: HistoryCacheEntry,
): HistoryCache {
  cache.set(hash, entry);
  return cache;
}

/**
 * 古いエントリを削除（キャッシュサイズ制限）
 * @param cache 履歴キャッシュ
 * @param maxSize 最大サイズ
 * @returns 削除されたエントリの配列（呼び出し側で`close()`を呼ぶ必要がある）
 */
export function evictOldEntries(
  cache: HistoryCache,
  maxSize: number,
): HistoryCacheEntry[] {
  if (cache.size <= maxSize) {
    return [];
  }

  const entries = Array.from(cache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp); // 古い順
  const toRemove = entries.slice(0, entries.length - maxSize);

  const removed: HistoryCacheEntry[] = [];
  for (const [hash, entry] of toRemove) {
    cache.delete(hash);
    removed.push(entry);
  }

  return removed;
}

/**
 * 履歴キャッシュをクリア
 * @param cache 履歴キャッシュ
 * @returns クリアされたエントリの配列（呼び出し側で`close()`を呼ぶ必要がある）
 */
export function clearHistoryCache(cache: HistoryCache): HistoryCacheEntry[] {
  const entries = Array.from(cache.values());
  cache.clear();
  return entries;
}

/**
 * 履歴キャッシュにエントリを保存し、古いエントリを削除
 * @param cache 履歴キャッシュ
 * @param hash drawingHash
 * @param entry エントリ
 * @param maxSize 最大サイズ
 * @returns 削除されたエントリの配列（呼び出し側で`close()`を呼ぶ必要がある）
 */
export function saveAndEvict(
  cache: HistoryCache,
  hash: string,
  entry: HistoryCacheEntry,
  maxSize: number,
): HistoryCacheEntry[] {
  // 既存のエントリを取得（削除対象に含める）
  const existing = cache.get(hash);
  const toClose: HistoryCacheEntry[] = existing ? [existing] : [];

  // 新しいエントリを保存
  saveToHistoryCache(cache, hash, entry);

  // 古いエントリを削除
  const evicted = evictOldEntries(cache, maxSize);
  toClose.push(...evicted);

  return toClose;
}
