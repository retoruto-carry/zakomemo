# 現在の描画・キャッシュの仕組み（詳細解説）

## キャッシュの種類

### 1. **通常のフレームキャッシュ** (`this.frameBitmaps`)

- **場所**: `CanvasRenderer`内
- **内容**: 3 フレーム分の`ImageBitmap`（`[null, null, null]`）
- **用途**: アニメーションループで使用される現在のフレーム
- **更新タイミング**: 新しいストローク追加時、キャッシュ無効化時

### 2. **履歴キャッシュ** (`this.historyCache`)

- **場所**: `CanvasRenderer`内（`HistoryCache`型）
- **内容**: `Map<drawingHash, HistoryCacheEntry>`
  - 各エントリ: `{ frameBitmaps: ImageBitmap[], jitterConfig, timestamp }`
- **用途**: undo/redo 時の高速化
- **最大サイズ**: 5 個（最新 5 個の履歴状態を保持）
- **更新タイミング**: すべてのフレームが生成された時

### 3. **キャッシュメタデータ**

- `this.cachedStrokeIds`: キャッシュ済みのストローク ID のセット
- `this.cachedStrokePointCounts`: ストローク ID ごとのポイント数（ポイント単位の差分描画用）
- `this.cachedDrawingHash`: 現在の Drawing のハッシュ
- `this.cachedJitterConfig`: 現在の jitterConfig

## シナリオ別の動作フロー

### シナリオ 1: 線を書いているとき

#### 1. **`pointerDown`** (ストローク開始)

```
WigglyEngine.pointerDown()
  → startStroke() で新しいストロークを作成
  → this.history.present を更新（履歴にはまだ追加されない）
  → アニメーションループが続行
```

#### 2. **`pointerMove`** (ストローク描画中)

```
WigglyEngine.pointerMove()
  → appendPoint() でポイントを追加
  → this.history.present を更新
  → アニメーションループが続行
```

#### 3. **アニメーションループ** (約 45fps)

```
WigglyEngine.loop()
  → renderDrawingAtTime()
    → 現在のフレームインデックスを計算（0, 1, 2を循環）
    → renderer.getFrameBitmap() を非同期で呼び出し
```

#### 4. **`getFrameBitmap`** (フレーム取得)

```
CanvasRenderer.getFrameBitmap()
  → drawingHash を計算

  【ステップ1】履歴キャッシュをチェック
    → 新しいストロークがあるため、履歴キャッシュにはヒットしない

  【ステップ2】通常のキャッシュをチェック
    → this.cachedDrawingHash === drawingHash をチェック
    → 新しいストロークがあるため、不一致

  【ステップ3】新しいストロークまたはポイント追加を検出
    → this.getNewStrokes() で新しいストロークを取得
    → this.getStrokesWithNewPoints() でポイント追加されたストロークを取得
    → newStrokes.length > 0 または strokesWithNewPoints.length > 0 の場合:

      【ステップ3-1】要求されたフレームを優先的に生成
        → 全消しの場合: renderFrameFromScratch() を同期的に実行
        → 通常の場合: renderFrameWithDiff() を同期的に実行
          → 前のImageBitmapからImageDataを取得
          → 新しいストローク全体を描画（差分描画）
          → 既存ストロークの新しいポイントだけを描画（ポイント単位の差分描画）
          → ImageDataをoffscreenCanvasに書き込み
          → createImageBitmap() でImageBitmapを作成
          → this.frameBitmaps[frameIndex] を更新
          → this.cachedStrokeIds と this.cachedStrokePointCounts を更新
          → this.cachedDrawingHash を更新

          【重要】すべてのフレームが生成された場合:
            → this.saveToHistoryCache() を呼び出し
              → 履歴キャッシュに保存（参照を共有）
              → 古いエントリを削除（MAX_HISTORY_CACHE_SIZE=5）

      【ステップ3-2】他のフレームを非同期で生成
        → regenerateOtherFramesAsync() を呼び出し（ブロックしない）
          → ストローク描画中（isDrawingActive=true）の場合はスキップ
          → 他の2フレームを非同期で生成
          → 完了したら this.frameBitmaps[i] を更新

    → 要求されたフレームのImageBitmapを返す

  → renderer.flushFromBitmap() でメインキャンバスに描画
```

#### 5. **`pointerUp`** (ストローク終了)

```
WigglyEngine.pointerUp()
  → pushHistory() で履歴に追加
    → this.history.past に現在の状態を追加
    → this.history.present を更新
    → this.history.future をクリア
  → this.onHistoryChange() を呼び出し
  → アニメーションループが続行
```

**ポイント**:

- ストローク描画中は、要求されたフレームのみ同期的に生成（他のフレームは非同期）
- すべてのフレームが生成されたら、履歴キャッシュに保存
- バックグラウンド生成はストローク描画中はスキップ（パフォーマンス保護）

---

### シナリオ 2: undo

#### 1. **`undo()` 呼び出し**

```
WigglyEngine.undo()
  → undoHistory() で履歴を更新
    → this.history.past から最後の状態を取得
    → this.history.present を更新
    → this.history.future に現在の状態を追加
  → this.clearRendererCache() を呼び出し
    → this.renderer.clearPatternCache()
      → this.invalidateCache(false) を呼び出し
        → this.frameBitmaps をクリア（close()）
        → this.cachedStrokeIds をクリア
        → this.cachedDrawingHash をクリア
        → clearHistory=false なので、履歴キャッシュは保持
```

#### 2. **アニメーションループ** (次回の描画時)

```
WigglyEngine.loop()
  → renderDrawingAtTime()
    → renderer.getFrameBitmap() を非同期で呼び出し
```

#### 3. **`getFrameBitmap`** (フレーム取得)

```
CanvasRenderer.getFrameBitmap()
  → drawingHash を計算（undo後のDrawing）

  【ステップ1】履歴キャッシュをチェック
    → getFromHistoryCache(this.historyCache, drawingHash)
    → 履歴キャッシュにヒットした場合:
      → 履歴キャッシュからImageBitmapを取得
      → this.frameBitmaps を更新（履歴キャッシュの参照を共有）
      → this.cachedStrokeIds を更新
      → this.cachedDrawingHash を更新
      → ImageBitmapを即座に返す（再生成不要！）

  【ステップ2】履歴キャッシュにヒットしない場合
    → 通常のキャッシュをチェック（無効）
    → renderFrameFromScratch() で全ストロークから再生成
    → すべてのフレームが生成されたら、履歴キャッシュに保存
```

**ポイント**:

- undo 時は通常のキャッシュのみクリア（履歴キャッシュは保持）
- 履歴キャッシュにヒットすれば、即座に取得（再生成不要）
- 履歴キャッシュにヒットしない場合は、全ストロークから再生成

---

### シナリオ 3: redo

#### 1. **`redo()` 呼び出し**

```
WigglyEngine.redo()
  → redoHistory() で履歴を更新
    → this.history.future から最初の状態を取得
    → this.history.present を更新
    → this.history.past に現在の状態を追加
  → this.clearRendererCache() を呼び出し
    → this.invalidateCache(false) を呼び出し
      → 通常のキャッシュのみクリア
      → 履歴キャッシュは保持
```

#### 2. **アニメーションループ** (次回の描画時)

```
WigglyEngine.loop()
  → renderDrawingAtTime()
    → renderer.getFrameBitmap() を非同期で呼び出し
```

#### 3. **`getFrameBitmap`** (フレーム取得)

```
CanvasRenderer.getFrameBitmap()
  → drawingHash を計算（redo後のDrawing）

  【ステップ1】履歴キャッシュをチェック
    → 履歴キャッシュにヒットした場合:
      → 即座にImageBitmapを返す（再生成不要！）

  【ステップ2】履歴キャッシュにヒットしない場合
    → 全ストロークから再生成
```

**ポイント**:

- redo 時も undo 時と同様に、履歴キャッシュを活用
- 履歴キャッシュにヒットすれば、即座に取得

---

### シナリオ 4: 全消し

#### 1. **`clear()` 呼び出し**

```
WigglyEngine.clear()
  → clearDrawing() でDrawingをクリア
  → pushHistory() で履歴に追加
  → this.onHistoryChange() を呼び出し
```

#### 2. **アニメーションループ** (次回の描画時)

```
WigglyEngine.loop()
  → renderDrawingAtTime()
    → renderer.getFrameBitmap() を非同期で呼び出し
```

#### 3. **`getFrameBitmap`** (フレーム取得)

```
CanvasRenderer.getFrameBitmap()
  → drawingHash を計算（空のDrawing）

  【ステップ1】履歴キャッシュをチェック
    → 空のDrawingのハッシュでチェック
    → ヒットする可能性は低い（初回の全消しの場合）

  【ステップ2】通常のキャッシュをチェック
    → 無効（drawingHashが変更されているため）

  【ステップ3】全ストロークから再生成
    → renderFrameFromScratch()
      → ImageDataを初期化（背景色でクリア）
      → ストロークが0個なので、描画処理はスキップ
      → ImageBitmapを作成（背景色のみ）
      → this.frameBitmaps を更新
      → すべてのフレームが生成されたら、履歴キャッシュに保存
```

**ポイント**:

- 全消し後は、空の Drawing から再生成
- 履歴キャッシュに保存される（次回の全消し時に高速化される可能性）

---

## キャッシュのライフサイクル

### 通常のフレームキャッシュ (`this.frameBitmaps`)

- **作成**: `renderFrameFromScratch()` で生成
- **更新**: 新しいストローク追加時、キャッシュ無効化時
- **破棄**: `invalidateCache()` で `close()`

### 履歴キャッシュ (`this.historyCache`)

- **作成**: すべてのフレームが生成された時（`saveToHistoryCache()`）
- **更新**: 新しいエントリを追加、古いエントリを削除（MAX_HISTORY_CACHE_SIZE=5）
- **破棄**:
  - `clearHistoryCache()` で全削除（背景色変更など）
  - `invalidateCache(false)` の場合は保持（undo/redo 時）

## パフォーマンス特性

### 最適化されているケース

1. **新しいストローク追加時**: 要求されたフレームのみ同期的に生成（約 3 倍高速化）
2. **undo/redo 時（履歴キャッシュヒット）**: 即座に取得（実質 0ms）
3. **アニメーションループ（キャッシュヒット）**: 既存の ImageBitmap を返す（実質 0ms）

### パフォーマンスがかかるケース

1. **undo/redo 時（履歴キャッシュミス）**: 全ストロークから再生成（O(S × P × W²)）
2. **新しいストローク追加時（初回）**: 全ストロークから再生成
3. **全消し時**: 空の Drawing から再生成（軽量）

## 注意点

### ImageBitmap の参照共有

- 現在の実装では、履歴キャッシュと`this.frameBitmaps`で ImageBitmap の参照を共有
- `invalidateCache(false)`が呼ばれた場合、`this.frameBitmaps`が`close()`されると、履歴キャッシュの ImageBitmap も無効になる可能性
- ただし、現在の実装では`clearPatternCache()`は`invalidateCache()`を呼び出し、デフォルトで`clearHistory=true`のため、履歴キャッシュもクリアされる
- 詳細は `docs/imagebitmap-clone-analysis.md` を参照
