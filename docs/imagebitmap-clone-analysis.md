# ImageBitmapクローンの必要性分析

## 現在の実装の問題点

### 参照共有の問題

現在の実装では、履歴キャッシュに`this.frameBitmaps`の参照をそのまま保存しています：

```typescript
const clonedBitmaps: (ImageBitmap | null)[] = [];
for (let i = 0; i < FRAME_COUNT; i++) {
  clonedBitmaps[i] = this.frameBitmaps[i]; // 暫定: 参照を共有
}
```

### 問題が発生するケース

1. **`invalidateCache(false)`が呼ばれた場合**:
   - `this.frameBitmaps[i]?.close()`が呼ばれる
   - 履歴キャッシュに保存したImageBitmapも同じ参照なので、無効になる
   - 次回のundo/redo時に、履歴キャッシュから取得しようとするとエラーになる可能性

2. **`renderFrameFromScratch`で新しいImageBitmapが生成された場合**:
   - `this.frameBitmaps[frameIndex]?.close()`が呼ばれる
   - 履歴キャッシュに保存したImageBitmapも同じ参照なので、無効になる

### 実際の影響

現在の実装では:
- `clearPatternCache()`は`invalidateCache(false)`を呼ぶ
- これはundo/redo時に呼ばれる
- しかし、undo/redo時は履歴キャッシュから取得するので、`this.frameBitmaps`は使われない
- **ただし、履歴キャッシュのImageBitmapが`close()`されると、次回のundo/redo時にエラーになる**

## 解決策

### オプション1: ImageBitmapを適切にクローンする（推奨）

```typescript
private async saveToHistoryCache(
  drawingHash: string,
  jitterConfig: JitterConfig,
): Promise<void> {
  // ImageBitmapをクローン（非同期）
  const clonedBitmaps: (ImageBitmap | null)[] = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const bitmap = this.frameBitmaps[i];
    if (bitmap && this.offscreenCanvas) {
      // オフスクリーンCanvasに描画してから再生成
      if (this.offscreenCtx) {
        this.offscreenCtx.clearRect(0, 0, this.lastWidth, this.lastHeight);
        this.offscreenCtx.drawImage(bitmap, 0, 0);
        clonedBitmaps[i] = await createImageBitmap(this.offscreenCanvas);
      }
    } else {
      clonedBitmaps[i] = null;
    }
  }
  
  // 履歴キャッシュに保存
  this.historyCache.set(drawingHash, {
    frameBitmaps: clonedBitmaps,
    jitterConfig: { ...jitterConfig },
    timestamp: Date.now(),
  });
}
```

**問題点**:
- `saveToHistoryCache`が非同期になる
- `renderFrameFromScratch`から呼び出す必要があるが、現在は同期的に呼ばれている

### オプション2: `invalidateCache(false)`の時に履歴キャッシュのImageBitmapを`close()`しない

```typescript
private invalidateCache(clearHistory = true): void {
  // 既存のImageBitmapを破棄
  // ただし、履歴キャッシュに保存されているものは`close()`しない
  const historyBitmapRefs = new Set<ImageBitmap>();
  if (!clearHistory) {
    for (const entry of this.historyCache.values()) {
      for (const bitmap of entry.frameBitmaps) {
        if (bitmap) {
          historyBitmapRefs.add(bitmap);
        }
      }
    }
  }
  
  for (let i = 0; i < this.frameBitmaps.length; i++) {
    if (this.frameBitmaps[i] && !historyBitmapRefs.has(this.frameBitmaps[i]!)) {
      this.frameBitmaps[i]?.close();
    }
    this.frameBitmaps[i] = null;
  }
  // ...
}
```

**問題点**:
- 複雑な実装になる
- 参照が共有されていることを前提にしている（脆弱）

### オプション3: 履歴キャッシュに保存するタイミングを変更

履歴キャッシュに保存するタイミングを、`invalidateCache`が呼ばれる前に変更する。

**問題点**:
- 実装が複雑になる
- すべてのフレームが生成されたタイミングを正確に把握する必要がある

## 推奨される実装

**オプション1（ImageBitmapを適切にクローンする）を推奨**します。

理由:
1. **堅牢性**: 参照の共有による問題を根本的に解決
2. **将来の拡張性**: 他の最適化を追加する際にも安全
3. **メモリ管理**: 適切にメモリを管理できる

実装の複雑さはありますが、長期的にはメンテナンスしやすくなります。

## 実装の優先度

- **高**: 現在の実装でも動作するが、将来的に問題が発生する可能性がある
- **中期的な改善**: 他の最適化が完了した後に実装することを推奨

