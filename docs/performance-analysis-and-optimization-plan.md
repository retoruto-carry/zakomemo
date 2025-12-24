# パフォーマンス分析と最適化計画

## 問題の切り分け

### 1. 太い線を引くときのアルゴリズムのパフォーマンス

#### 現在の実装
- **`calculateThickLinePixels`**: O(C × W²)
  - C = 中心線ピクセル数
  - W = 線の太さ
  - 各中心線ピクセルについて、半径W/2の円内のピクセルを計算

#### 計算量の詳細
- **中心線ピクセル数**: ストロークの長さに比例（例：100ピクセル）
- **各ピクセルあたりの計算**: (2×radius+1)² 回のループ
  - width=16 → radius=8 → 17×17 = 289回/ピクセル
  - width=32 → radius=16 → 33×33 = 1,089回/ピクセル
- **総計算量**: 100ピクセル × 289回 = 28,900回（width=16の場合）

#### 問題点
- 太い線（width=32以上）で長いストロークを引くと、計算量が膨大になる
- 各ピクセルで`Map`と`Set`の操作が発生（メモリアロケーション）

#### 改善案
1. **早期終了の最適化**: 既に描画済みの領域をスキップ（難しい）
2. **バッチ処理**: 一定数のピクセルごとに処理を分割（複雑）
3. **現状維持**: 実際の使用ケースでは許容範囲内の可能性が高い

### 2. リアルタイム描画で3フレーム分を同期的に一気に生成

#### 現在の実装
```typescript
// 新しいストロークがある場合
await this.regenerateAllFrames(drawing, jitterConfig);
// 3フレームを並列で生成するが、すべて完了するまで待つ
```

#### 問題点
- **同期的な待機**: `await Promise.all()`で3フレームすべての生成を待つ
- **描画のブロック**: 新しいストローク追加時に、描画がブロックされる可能性
- **メモリ使用量**: 3フレーム分のImageBitmapを同時に生成

#### 計算量
- **1フレームあたり**: O(S × P × W²)
  - S = ストローク数（例：50）
  - P = ポイント数/ストローク（例：100）
  - W = ブラシ幅（例：4）
  - 計算量: 50 × 100 × 16 = 80,000ピクセル描画
- **3フレーム**: 80,000 × 3 = 240,000ピクセル描画

#### 改善案
1. **非同期生成**: 要求されたフレームを優先的に生成し、他のフレームは非同期で生成
2. **段階的生成**: 最初に要求されたフレームだけを生成し、残りはバックグラウンドで生成
3. **遅延生成**: アニメーションループで各フレームが要求されたときに生成

### 3. undo/redo時のパフォーマンス

#### 現在の実装
```typescript
undo(): void {
  this.history = undoHistory(this.history);
  this.clearRendererCache(); // すべてのキャッシュをクリア
  // 次回getFrameBitmapが呼ばれたときに全再生成
}
```

#### 問題点
- undo/redo時にキャッシュをクリアするため、次回描画時に全再生成が必要
- ユーザーがundo/redoを連続で行うと、毎回全再生成が発生

#### 改善案
1. **履歴キャッシュ**: undo/redoの前後の状態をキャッシュ
   - `historyCache: Map<string, { frameBitmaps: ImageBitmap[], drawingHash: string }>`
   - キー: `drawingHash`または`history.present`のハッシュ
2. **非同期事前生成**: undo/redo後に、バックグラウンドでフレームを生成
3. **制限付きキャッシュ**: 最新のN個の履歴状態のみキャッシュ（メモリ制限）

## 最適化計画

### 優先度: 高

### 1. リアルタイム描画の最適化（段階的生成）

**問題**: 新しいストローク追加時に3フレームすべてを同期的に生成

**解決策**: 
- 要求されたフレーム（`frameIndex`）を優先的に生成
- 他のフレームは非同期でバックグラウンド生成
- 生成中は古いフレームを表示（一時的な不整合は許容）

**実装**:
```typescript
async getFrameBitmap(params: GetFrameBitmapParams): Promise<ImageBitmap> {
  // ... 既存のチェック ...
  
  if (newStrokes.length > 0) {
    // 要求されたフレームを優先的に生成
    const requested = await this.renderFrameFromScratch({
      drawing,
      frameIndex,
      frameElapsedTimeMs,
      jitterConfig,
    });
    
    // 他のフレームは非同期で生成（ブロックしない）
    this.regenerateOtherFramesAsync(drawing, jitterConfig, frameIndex);
    
    return requested;
  }
}

private regenerateOtherFramesAsync(
  drawing: Drawing,
  jitterConfig: JitterConfig,
  excludeIndex: number
): void {
  // 非同期で他のフレームを生成（awaitしない）
  const frameCount = FRAME_COUNT;
  const frameInterval = 100;
  
  for (let i = 0; i < frameCount; i++) {
    if (i === excludeIndex) continue;
    
    const frameElapsedTimeMs = i * frameInterval;
    this.renderFrameFromScratch({
      drawing,
      frameIndex: i,
      frameElapsedTimeMs,
      jitterConfig,
    }).catch((err) => {
      console.error(`Failed to generate frame ${i}:`, err);
    });
  }
}
```

### 2. undo/redo時の履歴キャッシュ

**問題**: undo/redo時に毎回全再生成が必要

**解決策**:
- 履歴状態ごとにフレームキャッシュを保持
- undo/redo時に、キャッシュがあれば使用、なければ生成
- バックグラウンドで前後の履歴状態を事前生成

**実装**:
```typescript
// 履歴キャッシュ: Map<drawingHash, { frameBitmaps: ImageBitmap[], timestamp: number }>
private historyCache: Map<string, {
  frameBitmaps: (ImageBitmap | null)[];
  timestamp: number;
}> = new Map();
private readonly MAX_HISTORY_CACHE_SIZE = 5; // 最新5個の履歴状態をキャッシュ

async getFrameBitmap(params: GetFrameBitmapParams): Promise<ImageBitmap> {
  const drawingHash = this.computeDrawingHash(drawing);
  
  // 履歴キャッシュをチェック
  const cached = this.historyCache.get(drawingHash);
  if (cached && cached.frameBitmaps[frameIndex]) {
    return cached.frameBitmaps[frameIndex]!;
  }
  
  // キャッシュがない場合は生成
  // ...
}

undo(): void {
  this.history = undoHistory(this.history);
  // キャッシュをクリアせず、履歴キャッシュを使用
  // バックグラウンドで前後の履歴状態を事前生成
  this.preloadHistoryFramesAsync();
}
```

### 3. 太い線のアルゴリズム最適化（オプション）

**現状**: 既に最適化されているが、さらに改善可能

**改善案**:
- 大きなストロークの場合は、処理を分割（例：100ピクセルごと）
- ただし、実装が複雑になるため、優先度は低い

## 実装の優先順位

1. **高**: リアルタイム描画の段階的生成（要求されたフレームを優先）
2. **中**: undo/redo時の履歴キャッシュ
3. **低**: 太い線のアルゴリズム最適化（現状で許容範囲内の可能性）

## 注意点

- **描画中の非同期生成**: ストローク追加中にバックグラウンド生成を行うと、描画パフォーマンスに影響する可能性
  - 解決策: ストローク追加中は非同期生成を一時停止
  - または、低優先度のタスクとして実行（`requestIdleCallback`など）

