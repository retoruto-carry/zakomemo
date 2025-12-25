# 描画システム設計（リファクタ後）

## 目的

- リアルタイム描画で「古い状態」を表示しない
- 1tick 内の重い処理を避け、45fps 目安で安定させる
- キャッシュの責務を分割し、差分/全再生成の判断を明確化する

## これだけ覚えれば OK

- 描画は RAF ループの tick で更新される（`minFrameIntervalMs = 1000/45` で間引き）
- 3 枚の `cycleBitmap` を 100ms 間隔で切り替える（`cycleIndex` は 0..2）
- 差分描画は「ストロークの追加（末尾に点が増えた）」のみ許可
- undo/redo/clear/背景色変更/サイズ変更/jitter 変更は全再生成
- 非同期結果は `requestId` と `renderCacheEpoch` で破棄される

## ざっくり流れ

1. 描画操作で `Drawing` が変わるたびに `drawingRevision++`
2. RAF の tick で `cycleIndex` を計算（0..2）
3. `frameKey = drawingRevision + jitterKey + cycleIndex`
4. `cacheKey = drawingId + renderCacheEpoch + jitterKey + cycleIndex`
5. `cycleBitmapCache` で `cacheKey` を引く
   - あるなら即描画
   - ないなら生成（差分 or 全再生成）
6. 生成完了時に `renderCacheEpoch` をチェック
   - 世代が変わっていたら破棄

## 時間とインデックス

- `elapsedTimeMs` は `WigglyEngine` の開始からの経過時間
- `cycleIndex = floor((elapsedTimeMs / cycleIntervalMs) % cycleCount)`
- 1 cycle は 100ms 固定、3 cycle で 300ms の揺れループになる

## 用語（短い説明）

- `renderTick`: RAF を間引いた描画更新の 1 回（`WigglyEngine.loop`）
- `cycleIndex`: 3 枚パラパラ用のインデックス（0..2）
- `cycleIntervalMs`: 100ms 固定の切替間隔
- `drawingRevision`: Drawing の内容が変わるたびに増える版番号
- `renderCacheEpoch`: 背景色やサイズ変更などで増えるキャッシュ世代
- `frameKey`: `drawingRevision + jitterKey + cycleIndex`
- `cacheKey`: `drawingId + renderCacheEpoch + jitterKey + cycleIndex`
- `cycleBitmap`: cycle ごとの `ImageBitmap`
- `cycleBitmapCache`: cycleBitmap と in-flight Promise を保持
- `ImageDataBuffer`: 差分/全再生成の作業バッファ（ImageData + offscreen）

## 差分描画の条件

- OK:
  - 既存ストロークの末尾にポイントが追加された
  - 新しいストロークが追加された
- NG（全再生成）:
  - ストローク削除・順序変更
  - undo / redo / clear
  - 背景色・サイズ・jitter の変更
  - ストロークの順序入れ替え（履歴操作含む）

## キャッシュの考え方

- キャッシュは「Drawing 状態を最大 6 件まで（LRU）」保持する
- 1 状態につき 3 cycle 分の ImageBitmap を持つ（最大 18 枚）
- `cycleIndex` ごとに描画済みの状態を持つ
- in-flight の Promise は再利用して重複生成を防ぐ
- `renderCacheEpoch` が進んだら古い結果は破棄される

## cycle ごとの状態

各 `cycleIndex` は以下を持つ:

- `tracker`: `StrokeChangeTracker`（この cycle の描画済み状態）
  - `drawingRevision`: この cycle が追従している revision
  - `jitterKey`: この cycle に適用された jitter 設定
  - `renderCacheEpoch`: この cycle の生成時点の世代
- `cacheKey`: LRU の参照キー

## 非同期と古い結果の破棄

- `createImageBitmap` は Promise を返すので生成は非同期で完了する
- `frameRenderer` の `requestId` が最新かどうかで flush を制御
- `CycleBitmapCache` は `renderCacheEpoch` が違う結果を捨てる
- これにより「古い Drawing が表示される」問題を回避する

## コンポーネント責務

- `ImageDataBuffer`
  - ImageData と offscreenCanvas の管理
  - 背景塗りつぶし、`setPixel`、`putImageData`
- `StrokeChangeTracker`
  - ストローク ID とポイント数を保持
  - 追加のみなら差分、削除/順序変更なら全再生成
- `FrameBuilder`
  - `buildFromScratch` / `buildWithDiff`
  - 描画ロジックは `strokeRendering.ts` を使用
- `CycleBitmapCache`
  - `cacheKey -> ImageBitmap` の LRU と in-flight を保持
  - Drawing 状態を最大 6 件まで保持（18 枚上限）
- `CanvasRenderer`
  - 判断と I/O のみ（オーケストレーション）
  - 実描画は上記に委譲

## 代表的なシナリオ

- 普通に描いている最中:
  - `drawingRevision++` → `buildWithDiff` で差分更新
  - 次の `cycleIndex` でも差分で追従
- undo / redo:
  - `renderCacheEpoch++` → 全再生成
- 背景色変更:
  - `renderCacheEpoch++` → 全再生成

## フローチャート（テキスト）

```text
renderTick
  ├─ cycleIndex を計算
  ├─ frameKey = drawingRevision + jitterKey + cycleIndex
  ├─ cycleBitmapCache に cacheKey がある？
  │   ├─ YES: そのまま描画
  │   └─ NO:
  │       ├─ in-flight がある？
  │       │   ├─ YES: Promise を再利用
  │       │   └─ NO:
  │       │       ├─ StrokeChangeTracker が差分 OK？
  │       │       │   ├─ YES & baseBitmap あり → buildWithDiff
  │       │       │   └─ NO or baseBitmap なし → buildFromScratch
  │       │       └─ 完了後 renderCacheEpoch を確認
  │       │           ├─ 一致: cache に保存して描画
  │       │           └─ 不一致: 破棄
```

## 補足

- `drawingRevision` は巻き戻さない（undo/redo でも増える）
- `renderCacheEpoch` はキャッシュ世代の管理専用
- `cycleIntervalMs = 100` の前提で jitter の位相が決まる
- `cycleBitmap` は `flushFromBitmap` で描画される（ImageData は作業用）
