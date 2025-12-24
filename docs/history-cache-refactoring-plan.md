# 履歴キャッシュのリファクタリング計画

## 現状の問題点

1. **`CanvasRenderer`が肥大化**: 履歴キャッシュの管理ロジックが`CanvasRenderer`内に混在
2. **責務の分離不足**: 描画ロジックと履歴キャッシュ管理が同じクラスに存在
3. **テストの困難さ**: 履歴キャッシュのロジックを独立してテストしにくい

## 既存のアーキテクチャパターン

### `core`層: 関数型（純粋関数）
- `core/history.ts`: 関数型アプローチ
- `core/jitter.ts`: 関数型アプローチ
- `core/pixelArt.ts`: 関数型アプローチ

### `infra`層: クラスベース（ブラウザ依存）
- `infra/CanvasRenderer.ts`: クラスベース

## 設計方針

### 推奨: 関数型アプローチ（既存のコードベースと一貫性を保つ）

**理由**:
1. 既存の`core/history.ts`が関数型で実装されている
2. `core`層の設計方針（純粋関数）と一貫性がある
3. テストしやすい（純粋関数は単体テストが容易）
4. 状態管理とロジックを分離できる

### 実装方針

1. **`infra/historyCache.ts`を作成**:
   - 履歴キャッシュの管理ロジックを純粋関数として実装
   - 状態（`Map`）は`CanvasRenderer`に保持
   - ロジックは純粋関数として分離

2. **型定義**:
   ```typescript
   export type HistoryCacheEntry = {
     frameBitmaps: (ImageBitmap | null)[];
     jitterConfig: JitterConfig;
     timestamp: number;
   };

   export type HistoryCache = Map<string, HistoryCacheEntry>;
   ```

3. **純粋関数として実装**:
   - `saveToHistoryCache(cache: HistoryCache, hash: string, ...): HistoryCache`
   - `getFromHistoryCache(cache: HistoryCache, hash: string, ...): ImageBitmap | null`
   - `clearHistoryCache(cache: HistoryCache): HistoryCache`
   - `evictOldEntries(cache: HistoryCache, maxSize: number): HistoryCache`

4. **副作用（ImageBitmapの`close()`）は`CanvasRenderer`で管理**:
   - 純粋関数は`HistoryCache`を返すだけ
   - `close()`の呼び出しは`CanvasRenderer`で行う

## 実装計画

### ステップ1: 型定義と純粋関数の作成
- `infra/historyCache.ts`を作成
- 型定義と純粋関数を実装

### ステップ2: `CanvasRenderer`のリファクタリング
- 履歴キャッシュの管理ロジックを`historyCache.ts`に移行
- `CanvasRenderer`は状態を保持し、純粋関数を呼び出す

### ステップ3: テストの追加
- `infra/historyCache.test.ts`を作成
- 純粋関数の単体テストを実装

## 代替案: クラスベースアプローチ

### Mementoパターン風の実装

```typescript
class HistoryCacheManager {
  private cache: Map<string, HistoryCacheEntry> = new Map();
  private readonly maxSize: number;

  save(hash: string, entry: HistoryCacheEntry): void { ... }
  get(hash: string): HistoryCacheEntry | null { ... }
  clear(): void { ... }
}
```

**問題点**:
- 既存のコードベース（`core`層）と一貫性がない
- 状態とロジックが結合している
- テストが複雑になる（モックが必要）

## 結論

**関数型アプローチを推奨**します。既存のコードベースと一貫性があり、テストしやすく、責務の分離が明確になります。

