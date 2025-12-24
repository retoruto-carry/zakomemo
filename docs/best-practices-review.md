# ベストプラクティスレビュー: ポイント単位の差分描画

## レビュー結果

### ✅ 良い点

1. **型安全性**: TypeScriptの型定義が適切
2. **エラーハンドリング**: `try...finally`でリソース管理が適切
3. **コメント**: 主要な処理にコメントが追加されている
4. **命名規則**: メソッド名が明確で意図が伝わる
5. **テスト**: すべてのテストが通過

### ⚠️ 改善が必要な点

#### 1. **パフォーマンスの問題: 重複したjitter計算**

**問題**: `renderFrameWithDiff`内で、既存のストロークに対して`applyJitterToStroke`を2回呼び出している

```typescript
// 920-930行目
const allJittered = applyJitterToStroke({
  stroke,
  elapsedTimeMs: frameElapsedTimeMs,
  jitterConfig,
});
// 新しいポイントに対応するjitter適用済みポイントを取得
const newJittered = allJittered.slice(
  Math.max(0, cachedPointCount - 1),
  allJittered.length
);
```

**問題点**:
- ストローク全体にjitterを適用してから、必要な部分だけをスライスしている
- 既に描画済みのポイントにもjitterを適用している（無駄）

**改善案**: 新しいポイントだけにjitterを適用する

```typescript
// 新しいポイントだけを取得
const newPoints = stroke.points.slice(cachedPointCount);
if (newPoints.length === 0) continue;

// 新しいポイントだけにjitterを適用
// ただし、前のポイントとの接続のために1つ前のポイントも含める
const pointsForJitter = stroke.points.slice(
  Math.max(0, cachedPointCount - 1),
  stroke.points.length
);
const jittered = applyJitterToStroke({
  stroke: { ...stroke, points: pointsForJitter },
  elapsedTimeMs: frameElapsedTimeMs,
  jitterConfig,
});
```

ただし、`applyJitterToStroke`はストローク全体を受け取るため、この改善は難しい可能性があります。

**代替案**: `applyJitterToStroke`を修正して、ポイントの範囲を指定できるようにする

#### 2. **型定義の改善**

**問題**: `getStrokesWithNewPoints`の戻り値の型がインラインで定義されている

```typescript
private getStrokesWithNewPoints(drawing: Drawing): Array<{
  stroke: Stroke;
  cachedPointCount: number;
}> {
```

**改善案**: 型を別途定義する

```typescript
type StrokeWithNewPoints = {
  stroke: Stroke;
  cachedPointCount: number;
};

private getStrokesWithNewPoints(drawing: Drawing): StrokeWithNewPoints[] {
```

#### 3. **コードの重複: キャッシュ更新ロジック**

**問題**: キャッシュ更新のロジックが`renderFrameWithDiff`と`renderFrameFromScratch`で重複している

**改善案**: 共通メソッドに抽出する

```typescript
private updateCache(
  drawing: Drawing,
  jitterConfig: JitterConfig
): void {
  // キャッシュされたストロークIDとポイント数を更新
  this.cachedStrokeIds.clear();
  this.cachedStrokePointCounts.clear();
  for (const stroke of drawing.strokes) {
    this.cachedStrokeIds.add(stroke.id);
    this.cachedStrokePointCounts.set(stroke.id, stroke.points.length);
  }
  const drawingHash = this.computeDrawingHash(drawing);
  this.cachedDrawingHash = drawingHash;
  this.cachedJitterConfig = { ...jitterConfig };
}
```

#### 4. **変数スコープの問題**

**問題**: `strokesWithNewPoints`が`try`ブロック内で定義されているが、`finally`ブロックの外で使用されている可能性がある

**現在のコード**:
```typescript
try {
  // ...
  const strokesWithNewPoints = this.getStrokesWithNewPoints(drawing);
  // ...
} finally {
  // strokesWithNewPointsはここでは使用されていないが、
  // キャッシュ更新で使用されている
}
```

**確認**: 実際には`strokesWithNewPoints`は`try`ブロック内で使用されているため、問題ありません。

#### 5. **コメントの改善**

**問題**: 一部のコメントが冗長

**改善案**: より簡潔で明確なコメントに変更

```typescript
// 新しいポイントだけを取得（前のポイントとの接続のために1つ前のポイントも含める）
const newPoints = stroke.points.slice(
  Math.max(0, cachedPointCount - 1),
  stroke.points.length
);
```

→

```typescript
// 新しいポイントを取得（前のポイントとの接続のため、1つ前のポイントも含める）
const newPoints = stroke.points.slice(
  Math.max(0, cachedPointCount - 1),
  stroke.points.length
);
```

## 推奨される改善

### 優先度: 高

1. **パフォーマンス最適化**: jitter計算の重複を解消
   - `applyJitterToStroke`を修正して、ポイントの範囲を指定できるようにする
   - または、新しいポイントだけにjitterを適用する専用メソッドを作成

### 優先度: 中

2. **型定義の改善**: 戻り値の型を別途定義
3. **コードの重複解消**: キャッシュ更新ロジックを共通メソッドに抽出

### 優先度: 低

4. **コメントの改善**: より簡潔で明確なコメントに変更

## 結論

現在の実装は**基本的にベストプラクティスに沿っている**が、以下の改善を推奨します：

1. **パフォーマンス**: jitter計算の重複を解消（最重要）
2. **保守性**: 型定義とコードの重複を改善
3. **可読性**: コメントを改善

これらの改善により、コードの品質がさらに向上します。

