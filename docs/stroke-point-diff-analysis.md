# ストロークとポイントの差分描画について

## 現在の実装の問題点

### ストロークとポイントの構造

```typescript
type Stroke = {
  id: string; // ストロークの一意ID
  kind: StrokeKind; // "draw" | "erase"
  brush: BrushSettings;
  points: Point[]; // ポイントの配列
};
```

### リアルタイム描画時の動作

1. **`pointerDown`**: 新しいストロークを作成（新しい ID）
2. **`pointerMove`**: 既存のストロークの`points`配列に新しいポイントを追加
   - ストローク ID は変わらない
   - `points.length`が増える

### 現在の差分描画の実装

#### `getNewStrokes`の実装

```typescript
private getNewStrokes(drawing: Drawing): Stroke[] {
  return drawing.strokes.filter(
    (stroke) => !this.cachedStrokeIds.has(stroke.id),
  );
}
```

**問題**: ストローク ID で判定しているため、リアルタイム描画時にポイントが追加されても「新しいストローク」として判定されない

#### `computeDrawingHash`の実装

```typescript
private computeDrawingHash(drawing: Drawing): string {
  const strokeInfo = drawing.strokes
    .map((s) => `${s.id}:${s.points.length}`)
    .join(",");
  return `${drawing.width}x${drawing.height}:${drawing.strokes.length}:${strokeInfo}`;
}
```

**問題**: `points.length`が含まれているため、ポイントが追加されるとハッシュが変わり、キャッシュが無効になる

#### `renderFrameWithDiff`の実装

```typescript
// 新しいストロークだけを描画
for (const stroke of newStrokes) {
  const jittered = applyJitterToStroke({...});
  this.renderStroke(stroke, jittered, frameElapsedTimeMs);
}
```

**問題**: ストローク全体を描画しているため、リアルタイム描画時に既に描画済みのポイントも再描画される

## 問題の詳細

### シナリオ: リアルタイム描画時

1. **初回描画**（ポイント 1 個）:

   - `getNewStrokes`: 新しいストロークとして判定 ✅
   - `renderFrameWithDiff`: ストローク全体を描画（ポイント 1 個） ✅
   - `cachedStrokeIds`: ストローク ID を追加 ✅

2. **ポイント追加**（ポイント 2 個）:

   - `computeDrawingHash`: ハッシュが変わる（`points.length`が 2 に）
   - `isCacheValid`: `false`（ハッシュが不一致）
   - `renderFrameFromScratch`: **全再生成** ❌
   - 差分描画が使われない

3. **ポイント追加**（ポイント 3 個）:
   - 同様に全再生成 ❌

### 根本的な問題

1. **ストローク単位の判定**: `getNewStrokes`はストローク ID で判定しているが、リアルタイム描画時は同じストロークのポイントが追加される
2. **ハッシュの計算**: `points.length`が含まれているため、ポイントが追加されるとキャッシュが無効になる
3. **描画の粒度**: ストローク全体を描画しているため、既に描画済みのポイントも再描画される

## 改善案

### オプション 1: ポイント単位の差分描画

既存のストロークに対して、新しいポイントだけを描画する。

```typescript
private getNewPoints(stroke: Stroke, cachedPointCount: number): Point[] {
  return stroke.points.slice(cachedPointCount);
}

private async renderFrameWithDiff(...) {
  // 新しいストローク全体を描画
  for (const stroke of newStrokes) {
    this.renderStroke(stroke, jittered, frameElapsedTimeMs);
  }

  // 既存のストロークの新しいポイントだけを描画
  for (const stroke of existingStrokes) {
    const cachedPointCount = this.getCachedPointCount(stroke.id);
    const newPoints = this.getNewPoints(stroke, cachedPointCount);
    if (newPoints.length > 0) {
      // 新しいポイントだけを描画
      this.renderStrokePoints(stroke, newPoints, jittered, frameElapsedTimeMs);
    }
  }
}
```

**メリット**:

- 既に描画済みのポイントを再描画しない
- パフォーマンスが向上

**デメリット**:

- 実装が複雑になる
- `renderStrokePoints`などの新しいメソッドが必要

### オプション 2: ストロークのポイント数をキャッシュ

ストローク ID とポイント数のペアをキャッシュし、ポイント数が増えた場合のみ差分描画する。

```typescript
private cachedStrokePointCounts: Map<string, number> = new Map();

private getStrokesWithNewPoints(drawing: Drawing): Stroke[] {
  return drawing.strokes.filter((stroke) => {
    const cachedCount = this.cachedStrokePointCounts.get(stroke.id) ?? 0;
    return stroke.points.length > cachedCount;
  });
}

private async renderFrameWithDiff(...) {
  // ポイント数が増えたストロークだけを描画
  // ただし、既に描画済みのポイントも再描画される（現状の実装）
  for (const stroke of strokesWithNewPoints) {
    this.renderStroke(stroke, jittered, frameElapsedTimeMs);
  }
}
```

**メリット**:

- 実装が比較的簡単
- ポイントが追加されたストロークを特定できる

**デメリット**:

- 既に描画済みのポイントも再描画される（効率が悪い）

### オプション 3: ハッシュの計算方法を変更

`points.length`をハッシュに含めず、ストローク ID のみで判定する。

```typescript
private computeDrawingHash(drawing: Drawing): string {
  const strokeIds = drawing.strokes.map((s) => s.id).join(",");
  return `${drawing.width}x${drawing.height}:${drawing.strokes.length}:${strokeIds}`;
}
```

**問題**: ポイント数が変わってもハッシュが変わらないため、キャッシュが有効になってしまう

- しかし、`getNewStrokes`で新しいストロークを判定できない

### オプション 4: 現在の実装を維持（全再生成）

リアルタイム描画時は全再生成を許容し、ストローク完了時のみ差分描画を使用する。

**メリット**:

- 実装がシンプル
- ストローク完了時は差分描画で高速化

**デメリット**:

- リアルタイム描画時のパフォーマンスが悪い

## 推奨案

**オプション 1（ポイント単位の差分描画）**を推奨します。

理由:

1. **パフォーマンス**: 既に描画済みのポイントを再描画しないため、最も効率的
2. **正確性**: リアルタイム描画時も正しく動作
3. **将来性**: より細かい制御が可能

ただし、実装が複雑になるため、段階的に実装することを推奨します。

## 現在の動作

現在の実装では、リアルタイム描画時にポイントが追加されると：

1. `computeDrawingHash`でハッシュが変わる（`points.length`が増える）
2. `isCacheValid`が`false`になる
3. `renderFrameFromScratch`が呼ばれる（全再生成）

つまり、**リアルタイム描画時は差分描画が使われず、全再生成が行われている**。

これは、ユーザーが指摘した通り、**ストローク全体を描画している**ため、既に描画済みのポイントも再描画される問題があります。
