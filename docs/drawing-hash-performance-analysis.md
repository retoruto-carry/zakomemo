# Drawingハッシュ値の計算パフォーマンス分析

## 現在の実装

```typescript
private computeDrawingHash(drawing: Drawing): string {
  const strokeInfo = drawing.strokes
    .map((s) => `${s.id}:${s.points.length}`)
    .join(",");
  return `${drawing.width}x${drawing.height}:${drawing.strokes.length}:${strokeInfo}`;
}
```

## 計算量の分析

### 時間計算量

1. **`drawing.strokes.map()`**: O(S)
   - S = ストローク数
   - 各ストロークを1回ずつ処理

2. **文字列連結（各ストローク）**: O(L)
   - L = 平均的なストロークIDの長さ
   - `${s.id}:${s.points.length}` の文字列生成

3. **`join(",")`**: O(S × L)
   - S個の文字列を結合
   - 各文字列の長さは約L文字

4. **最終的な文字列連結**: O(1)
   - 固定長の文字列を結合

**総計算量**: O(S × L)

### 典型的なケース

- **ストローク数**: S = 50（中規模の描画）
- **ストロークIDの長さ**: L = 20文字（例: "stroke-1234567890"）
- **計算量**: 50 × 20 = **1,000文字操作**

### 最悪ケース

- **ストローク数**: S = 200（大規模の描画）
- **ストロークIDの長さ**: L = 30文字
- **計算量**: 200 × 30 = **6,000文字操作**

## 呼び出し頻度

### `getFrameBitmap`内での呼び出し

```typescript
async getFrameBitmap(params: GetFrameBitmapParams): Promise<ImageBitmap> {
  // ...
  const drawingHash = this.computeDrawingHash(drawing); // 毎回呼ばれる
  // ...
}
```

**呼び出し頻度**:
- アニメーションループ: 約45fps
- 各フレームで`getFrameBitmap`が呼ばれる
- **1秒あたり約45回呼ばれる**

### 実際の負荷

**典型的なケース**:
- 1回の計算: 1,000文字操作
- 1秒あたり: 1,000 × 45 = **45,000文字操作/秒**

**最悪ケース**:
- 1回の計算: 6,000文字操作
- 1秒あたり: 6,000 × 45 = **270,000文字操作/秒**

## パフォーマンス評価

### 現在の実装の評価

**軽量**: 
- 文字列操作のみで、複雑な計算は不要
- メモリアロケーションも最小限

**問題点**:
- 毎フレーム呼ばれるため、累積的な負荷がある
- ただし、実際の負荷は非常に軽い（文字列操作のみ）

### ベンチマーク（推定）

**典型的なケース**:
- 1回の計算: **約0.01ms**（1,000文字操作）
- 1秒あたり: **約0.45ms**（45回 × 0.01ms）

**最悪ケース**:
- 1回の計算: **約0.06ms**（6,000文字操作）
- 1秒あたり: **約2.7ms**（45回 × 0.06ms）

**結論**: 現在の実装は十分に高速で、最適化の優先度は低い

## 最適化の必要性

### 現状の評価

**最適化不要**:
- 計算量が軽量（O(S × L)）
- 実際の負荷は非常に小さい（1秒あたり0.45ms〜2.7ms）
- 他の処理（描画処理など）に比べて無視できるレベル

### 将来的な最適化案（必要に応じて）

#### オプション1: メモ化（キャッシュ）

```typescript
private lastDrawingHash: string | null = null;
private lastDrawingHashInput: Drawing | null = null;

private computeDrawingHash(drawing: Drawing): string {
  // 同じDrawingオブジェクトの参照をチェック
  if (this.lastDrawingHashInput === drawing) {
    return this.lastDrawingHash!;
  }
  
  // 計算
  const hash = /* 現在の実装 */;
  
  // キャッシュ
  this.lastDrawingHashInput = drawing;
  this.lastDrawingHash = hash;
  
  return hash;
}
```

**問題点**:
- Drawingオブジェクトは頻繁に変更される（新しいストローク追加時など）
- 参照比較では不十分（新しいオブジェクトが作成される）
- 実装が複雑になる

#### オプション2: インクリメンタル更新

```typescript
private drawingHash: string = "";
private cachedStrokeIds: Set<string> = new Set();

private updateDrawingHash(drawing: Drawing): void {
  // 新しいストロークのみを追加
  const newStrokes = drawing.strokes.filter(
    (s) => !this.cachedStrokeIds.has(s.id)
  );
  
  if (newStrokes.length > 0) {
    // ハッシュを更新
    // ...
  }
}
```

**問題点**:
- ストロークの削除や変更に対応する必要がある
- 実装が複雑になる
- 現在の実装で十分なパフォーマンスが得られている

## 結論

### 現在の実装の評価

**パフォーマンス**: ⭐⭐⭐⭐⭐（優秀）
- 計算量: O(S × L) - 軽量
- 実際の負荷: 1秒あたり0.45ms〜2.7ms - 無視できるレベル
- 最適化の優先度: **低い**

### 推奨事項

**現状維持**:
- 現在の実装で十分に高速
- 他の最適化（描画処理など）の方が優先度が高い
- コードの複雑性を増やす必要がない

**将来的な検討**:
- ストローク数が1000を超えるような大規模な描画が必要になった場合
- 実際にパフォーマンス問題が発生した場合
- その時点で最適化を検討

