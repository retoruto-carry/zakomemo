# キャッシュのキーについて

## キャッシュの種類とキー

### 1. **通常のフレームキャッシュ** (`this.frameBitmaps`)

#### キーの構成要素

1. **`this.cachedDrawingHash`**: Drawing のハッシュ値（文字列）
2. **`this.cachedJitterConfig`**: JitterConfig オブジェクト（直接比較）
3. **`this.frameBitmaps[frameIndex]`**: ImageBitmap の存在チェック

#### キャッシュ有効性の判定

```typescript
const isCacheValid =
  this.cachedDrawingHash === drawingHash &&
  this.isJitterConfigEqual(this.cachedJitterConfig, jitterConfig) &&
  this.frameBitmaps[frameIndex] !== null;
```

#### `drawingHash`の計算方法

```typescript
private computeDrawingHash(drawing: Drawing): string {
  const strokeInfo = drawing.strokes
    .map((s) => `${s.id}:${s.points.length}`)
    .join(",");
  return `${drawing.width}x${drawing.height}:${drawing.strokes.length}:${strokeInfo}`;
}
```

**フォーマット**: `"widthxheight:strokeCount:strokeId1:pointsLength1,strokeId2:pointsLength2,..."`

**例**:

- 空の Drawing: `"384x256:0:"`
- ストローク 1 つ（ID: "stroke-1", ポイント数: 100）: `"384x256:1:stroke-1:100"`
- ストローク 2 つ: `"384x256:2:stroke-1:100,stroke-2:50"`

**特徴**:

- ストロークの ID とポイント数のみを使用（ポイントの座標は含まない）
- 同じストローク ID とポイント数なら、同じハッシュになる
- ストロークの順序は保持される（`map`の順序）

#### `jitterConfig`の比較

```typescript
private isJitterConfigEqual(cached: JitterConfig | null, current?: JitterConfig): boolean {
  // amplitude と frequency を比較
  return (
    cached.amplitude === current.amplitude &&
    cached.frequency === current.frequency
  );
}
```

**比較項目**:

- `amplitude`: ジッターの振幅
- `frequency`: ジッターの周波数

---

### 2. **履歴キャッシュ** (`this.historyCache`)

#### キーの構成要素

- **キー**: `drawingHash`（文字列）
- **値**: `HistoryCacheEntry`（`{ frameBitmaps, jitterConfig, timestamp }`）

#### キャッシュの構造

```typescript
type HistoryCache = Map<string, HistoryCacheEntry>;

// 使用例
const historyCacheEntry = getFromHistoryCache(this.historyCache, drawingHash);
if (
  historyCacheEntry &&
  this.isJitterConfigEqual(historyCacheEntry.jitterConfig, jitterConfig) &&
  historyCacheEntry.frameBitmaps[frameIndex] !== null
) {
  // 履歴キャッシュから取得
}
```

**特徴**:

- `drawingHash`をキーとして使用（通常のフレームキャッシュと同じ）
- `jitterConfig`は値に含まれ、取得時に別途チェック
- `timestamp`は削除時の優先順位決定に使用

---

## キャッシュキーの問題点と改善案

### 現在の実装の問題点

#### 1. **ストロークの内容が反映されない**

現在の`computeDrawingHash`は、ストロークの ID とポイント数のみを使用しています。

**問題**:

- 同じ ID とポイント数でも、ポイントの座標が異なる場合、同じハッシュになる
- ただし、実際にはストロークの ID は一意なので、この問題は発生しない可能性が高い

**例**:

```typescript
// ストローク1: ID="stroke-1", ポイント数=100
// ストローク2: ID="stroke-1", ポイント数=100（同じIDは存在しない）
// → 同じハッシュになるが、実際には同じストロークなので問題なし
```

#### 2. **ストロークの順序が重要**

`map`の順序に依存しているため、ストロークの順序が変わると異なるハッシュになる。

**例**:

```typescript
// ストローク順: [stroke-1, stroke-2]
// ハッシュ: "384x256:2:stroke-1:100,stroke-2:50"

// ストローク順: [stroke-2, stroke-1]（順序が逆）
// ハッシュ: "384x256:2:stroke-2:50,stroke-1:100"（異なるハッシュ）
```

**実際の影響**:

- 通常、ストロークの順序は変更されないため、問題にならない可能性が高い
- ただし、将来的にストロークの順序を変更する機能を追加する場合、問題になる可能性がある

#### 3. **jitterConfig の比較が別途必要**

履歴キャッシュでは、`drawingHash`だけでなく`jitterConfig`も別途チェックする必要がある。

**現在の実装**:

```typescript
if (
  historyCacheEntry &&
  this.isJitterConfigEqual(historyCacheEntry.jitterConfig, jitterConfig) &&
  historyCacheEntry.frameBitmaps[frameIndex] !== null
) {
  // 履歴キャッシュから取得
}
```

**改善案**:

- `drawingHash`に`jitterConfig`を含める（ただし、ハッシュが長くなる）
- または、現在の実装を維持（別途チェック）

---

## キャッシュキーの使用例

### シナリオ 1: 新しいストロークを追加

```
1. drawingHashを計算
   → "384x256:1:stroke-1:100"

2. 通常のキャッシュをチェック
   → this.cachedDrawingHash === "384x256:1:stroke-1:100" ?
   → 一致しない場合、再生成

3. 再生成後、キャッシュを更新
   → this.cachedDrawingHash = "384x256:1:stroke-1:100"
   → this.cachedStrokeIds = Set(["stroke-1"])
```

### シナリオ 2: undo（履歴キャッシュにヒット）

```
1. drawingHashを計算（undo後のDrawing）
   → "384x256:0:"（空のDrawing）

2. 履歴キャッシュをチェック
   → this.historyCache.get("384x256:0:") ?
   → ヒットした場合、即座に取得

3. 通常のキャッシュを更新
   → this.cachedDrawingHash = "384x256:0:"
   → this.frameBitmaps = 履歴キャッシュの参照
```

### シナリオ 3: jitterConfig が変更された場合

```
1. drawingHashを計算
   → "384x256:1:stroke-1:100"（同じ）

2. 通常のキャッシュをチェック
   → this.cachedDrawingHash === "384x256:1:stroke-1:100" ✓
   → this.isJitterConfigEqual(this.cachedJitterConfig, jitterConfig) ?
   → 一致しない場合、再生成

3. 履歴キャッシュをチェック
   → this.historyCache.get("384x256:1:stroke-1:100") ?
   → ヒットしても、jitterConfigが異なる場合は無効
```

---

## まとめ

### キャッシュキーの構成

| キャッシュの種類             | キー                           | 追加チェック                     |
| ---------------------------- | ------------------------------ | -------------------------------- |
| **通常のフレームキャッシュ** | `drawingHash` + `jitterConfig` | `frameBitmaps[frameIndex]`の存在 |
| **履歴キャッシュ**           | `drawingHash`                  | `jitterConfig`の一致             |

### `drawingHash`のフォーマット

```
"widthxheight:strokeCount:strokeId1:pointsLength1,strokeId2:pointsLength2,..."
```

### 特徴

- **軽量**: ストロークの ID とポイント数のみを使用
- **高速**: 文字列比較のみで判定
- **一意性**: ストロークの ID は一意なので、同じ Drawing なら同じハッシュになる
- **制限**: ストロークの順序に依存（通常は問題にならない）
