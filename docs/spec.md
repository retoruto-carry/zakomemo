# Wiggly Ugomemo 仕様書

## コンセプト
- 1枚のキャンバスに手描きで線を描くと、線がずっとぷるぷる揺れ続けるお絵かきアプリ。
- 線はドット/ストライプ/チェッカーなどのパターンブラシで塗りつぶせ、模様はキャンバス座標に固定されたままゆらゆら歪む。
- 描画中にペンの走り音を再生。消しゴム、2本指タップ Undo、GIF 出力に対応。PC/スマホ両対応。

## ユーザー機能
- ツール: ✏️ペン（ソリッド）、🎨パターン、🩹消しゴム。選択状態をUIで明示。
- カラーパレット: 固定4〜6色、デフォルト黒。パターン時も色を適用。
- 太さ: 1〜16px のスライダーで調整。
- 消しゴム: destination-out で透明に描画。太さはペン設定と連動でOK。
- Undo/Redo: 2本指タップで Undo。Redo は v0 ではボタン/ショートカットまたは未実装でも可。
- 全消し: 「全部消す」ボタンで履歴に push した上でクリア。
- GIF 出力: 12fps・約2秒（24フレーム）をデフォルトで書き出し、現在の揺れを反映したループGIFを保存。
- 入力: Pointer Events 統一。touchAction: none でスクロール抑制。PC/スマホ両対応。

## 技術スタック
- TypeScript（strict）
- React / Next.js（Vite等でも動かせる設計）
- Canvas 2D API
- Howler.js（サウンド）
- requestAnimationFrame（アニメーションループ）
- Pointer Events（マウス/タッチ共通）
- GIF エンコード用ライブラリ（gifenc/gif.js などをラップ）

## アーキテクチャ
- レイヤー:  
  - `core/` 純粋ロジック（型定義、Drawing操作、jitter、pattern処理、履歴管理）  
  - `engine/` アプリロジック（WigglyEngine。ポインタ入力→core更新、描画指揮、履歴）  
  - `infra/` ブラウザ依存実装（Canvas描画、Howler、時間、RAF、GIF）  
  - `ui/` Reactコンポーネント（キャンバスUI、ツールバー、2本指タップ検出）  
  - `app/` Wiring（依存注入）
- 依存方向: `core ← engine ← infra ← ui` （app は組み立て）。
- core は純粋関数のみ。engine は core+Port のみを参照し、ブラウザAPIを知らない。

## ドメイン仕様（core）
- 型: BrushKind/PatternId/BrushSettings、StrokeKind、Point(x,y,t)、Stroke(id/kind/brush/points)、Drawing(width/height/strokes)。
- Drawing操作: `startStroke` で新規ストローク追加、`appendPoint` でポイント追記、`clearDrawing` で全消去。すべて純粋関数。
- ぷるぷるノイズ: `computeJitter(Point, timeMs, JitterConfig)` が安定したオフセット(dx,dy)を返す。
- パターン: `PatternTile` と `PatternDefinition`。`getPatternDefinition` で id→定義取得（例: dots）。`wigglePatternTile` で時間に応じてタイルを歪ませる。
- 履歴: `History<T>` で past/present/future を保持。`create/push/undo/redoHistory` を提供。Drawingに適用。

## エンジン層（engine）
- Ports:  
  - DrawingRenderer(clear/renderStroke)  
  - TimeProvider(now)  
  - RafScheduler(request/cancel)  
  - GifEncoder(begin/addFrame/finish)  
  - StrokeSound(onStrokeStart/Update/End)
- frameRenderer: `renderDrawingAtTime(drawing, renderer, jitterConfig, timeMs)` で任意時刻の描画を共通化。
- WigglyEngine:  
  - History<Drawing> を保持し、tool/color/width の現在値を管理。  
  - pointerDown/move/up で core を更新し、stroke完了時のみ履歴に push。  
  - RAF ループで `renderDrawingAtTime` を呼ぶ。  
  - Undo/Redo/clear を公開。  
  - StrokeSound に速度/長さ情報を通知。
- GIF出力: `exportDrawingAsGif` が offscreen renderer + GifEncoder でフレームを積み、Blob を返す。

## インフラ層（infra）
- CanvasRenderer: Canvas2D で Stroke を描画。erase は destination-out、solid は色、pattern は wigglePatternTile→offscreenタイル→createPattern でワールド固定の模様を適用。DPR対応。
- その他: RealTimeProvider（performance.now）、BrowserRafScheduler（requestAnimationFrame）、HowlerStrokeSound（速度に応じたボリューム制御）、GIF エンコーダー実装（ライブラリラップ）。

## UI層
- `createWigglyEngine` が canvas・初期Drawingを受け取り、Renderer/Time/Raf/Sound を注入してエンジン生成。
- React `WigglyEditor`（例）: ツール切替ボタン、カラーパレット、太さスライダー、キャンバス。pointerdown/move/up を engine に渡し、2本指タップで Undo。touchAction: none でスクロール抑止。

## アニメーション/モーション指針
- 線の揺れ: 振幅 0.5〜2px 程度、1〜2秒周期のなめらかな揺れ。太さに応じて調整。
- パターンのゆらぎ: タイルを subtle に歪ませる（デフォルト amp ≒0.5px）。模様の位置はキャンバス原点基準で固定。
- UIモーション: ボタン押下で軽い縮小。ツール切替インジケータやGIF保存トーストはフェード/スライド等の軽いアニメ。

## サウンド指針
- 目的: 描画の触感を補強。ペン設置で再生開始、描画速度でボリューム変化、終了でフェードアウト。モバイルの自動再生制約に留意。

## 開発ポリシー
- TypeScript strict、ESLint/Prettier。純粋関数を core に集約。Magic number は設定経由で管理。高DPI対応。Undo 前提で全消し確認は省略可。
