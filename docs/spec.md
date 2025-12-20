# Wiggly Ugomemo 仕様書

## コンセプト
- 1枚のキャンバスに手描きで線を描くと、線がずっとぷるぷる揺れ続けるお絵かきアプリ。
- 線はドット/ストライプ/チェッカーなどのパターンブラシで塗りつぶせ、模様はキャンバス座標に固定されたままゆらゆら歪む。
- 描画中にペンの走り音を再生。消しゴム、2本指タップ Undo、GIF 出力に対応。PC/スマホ両対応。

## ユーザー機能
- ツール: ✏️ペン（ソリッド）、🎨パターン、🩹消しゴム。選択状態をUIで明示。
- カラーパレット: 6色（可変）。設定画面からプリセット（スタンダード、ゲームボーイ等）の選択、またはカスタム色の指定が可能。
- 本体色（テーマ）: DS本体（筐体）の色を変更可能。設定画面からプリセット（マットホワイト、メタリックレッド等、全20種）を選択可能。カスタムカラーも指定可能。
- 太さ: 1〜48px のスライダーで調整（初期値16px）。
- 消しゴム: destination-out で透明に描画。太さはペン設定と連動。プレビューは白抜きで表示。形状は円/四角/横線の3種。
- Undo/Redo: 「やり直し」「進む」ボタンおよび2本指タップで操作可能。履歴がある場合のみ有効（disabled状態で表示）。
- 全消し: 「消す」ボタンで履歴に push した上でクリア。
- 設定: 下画面を覆うフルスクリーンモーダル。「パレット」と「本体色」のタブ切り替え。カスタムスクロールバー実装。
- GIF 出力: 12fps・約2秒（24フレーム）をループGIFとして出力。保存後、X（Twitter）へのシェア機能あり。
  - モバイル: Web Share API対応時は画像付きシェア、非対応時はIntent URLでテキストシェア。
  - PC: Intent URLで新規タブを開く。

## 技術仕様：動的カラーシステム
- **CSS変数による管理**:
  - カラーパレットの色（`--palette-0`〜`--palette-5`）および本体各部位の色（`--ugo-body-bg`等）はCSS変数として管理。
  - ストローク描画時に変数を参照するため、設定でパレットを切り替えると**描画済みの線の色も動的に変化**する。
- **レンダラーのキャッシュ整合性**:
  - パレット変更時、CanvasRenderer 内のパターンキャッシュをクリアし、新しい色で模様が再生成されるように制御。
- **筐体テーマの反映**:
  - `DesktopLayout` / `MobileLayout` は筐体各部の色をCSS変数経由で参照し、設定変更を即座に反映。

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
- ぷるぷるノイズ:
  - `computeJitter(Point, timeMs, JitterConfig)`: ペン/消しゴム用。`point.t`（ストローク内の時間）を使い、各点が個別に揺れる。
  - `computePatternJitter(Point, timeMs, JitterConfig)`: パターン用。`point.t`を使わず座標とtimeMsのみで計算。同じ座標には同じjitterが適用され、異なるストロークでもパターンがずれない。
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
  - パターンスケーリング: `PATTERN_SCALE=2`により、パターンの密度を2倍に下げる（ドットや市松が粗く見える）。論理座標で一貫したサイズに見せるため`pattern.setTransform(PATTERN_SCALE*dpr)`で物理ピクセルをスケール。
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
