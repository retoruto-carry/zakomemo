# Zakomemo 仕様書

## コンセプト

- 1 枚のキャンバスに手描きで線を描くと、線がずっとぷるぷる揺れ続けるお絵かきアプリ。
- 線はドット/ストライプ/チェッカーなどのパターンブラシで塗りつぶせ、模様はキャンバス座標に固定されたままゆらゆら歪む。
- 描画中にペンの走り音を再生。消しゴム、Undo/Redo（UI/DSボタン）、GIF 出力に対応。PC/スマホ両対応。

## ユーザー機能

- ツール: ✏️ ペン（ソリッド）、🎨 パターン、🩹 消しゴム。選択状態を UI で明示。
- カラーパレット: 6 色（可変）。設定画面からプリセット（スタンダード/ノスタルジック/パステル/サイバー/サクラ/トワイライト/ヴィンテージ/アース/ネオン/レトロDS）を選択、またはカスタム色の指定が可能。
- 本体色（テーマ）: DS 本体（筐体）の色を変更可能。設定画面からプリセット（マットホワイト、メタリックレッド等、全 20 種）を選択可能。カスタムカラーも指定可能。
- 太さ: 1〜48px のスライダーで調整（初期値 16px）。
- 消しゴム: 背景色で描画（ImageDataに直接書き込み）。太さはペン設定と連動。プレビューは白抜きで表示。形状は円/四角/横線の 3 種。jitterは適用しない。
- Undo/Redo: 「やり直し」「進む」ボタンと DS ボタン（A/B）で操作可能。履歴がある場合のみ有効（disabled 状態で表示）。マルチタッチはピンチズームを優先し、2 本指タップ Undo は未実装。
- 全消し: 「消す」ボタンで履歴に push した上でクリア。
- 設定: 下画面を覆うフルスクリーンモーダル。「パレット」「本体色」「ぶるぶる」のタブ切り替え。カスタムスクロールバー実装。
  - 背景色: パレットプリセット/カスタムパレットに含めて選択。
  - ぶるぶる: 揺れの振幅と周波数をスライダーで調整可能。
- GIF 出力: jitterアニメーションは3フレーム固定で10fps（100ms間隔）を1ループ分だけ出力。GIFは無限ループ。保存後、X（Twitter）へのシェア機能あり。
  - モバイル: Web Share API 対応時は画像付きシェア、非対応時は Intent URL でテキストシェア。
  - PC: Intent URL で新規タブを開く。

## 技術仕様：動的カラーシステム

- **パレット参照の保持**:
  - ストロークは「パレットの色インデックス」を保持し、描画時にパレット配列から実色を解決する。
  - そのため、設定でパレットを切り替えると**描画済みの線の色も動的に変化**する。
- **UIのCSS変数**:
  - カラーパレットの色（`--palette-0`〜`--palette-5`）および本体各部位の色（`--zako-body-bg`等）は CSS 変数として管理。
- **レンダラーのキャッシュ整合性**:
  - パレット変更時は engine/renderer 側でキャッシュを無効化し、新しい色で再生成する。
- **筐体テーマの反映**:
  - `DesktopLayout` / `MobileLayout` は筐体各部の色を CSS 変数経由で参照し、設定変更を即座に反映。

## 技術スタック

- TypeScript（strict）
- React / Next.js（Vite 等でも動かせる設計）
- Canvas 2D API
- Howler.js（UI 要素のサウンド）
- Web Audio API（キャンバス描画音の動的生成）
- requestAnimationFrame（アニメーションループ）
- Pointer Events（マウス/タッチ共通）
- GIF エンコード用ライブラリ（gifenc/gif.js などをラップ）

## アーキテクチャ

- レイヤー:
  - `core/` 純粋ロジック（型定義、Drawing 操作、jitter、pattern 処理、履歴管理）
  - `engine/` アプリロジック（WigglyEngine。ポインタ入力 →core 更新、描画指揮、履歴）
  - `infra/` ブラウザ依存実装（Canvas 描画、Howler、時間、RAF、GIF）
  - `ui/` React コンポーネント（キャンバス UI、ツールバー、マルチタッチ時は描画を無効化）
  - `app/` Wiring（依存注入）
- 依存方向: `core ← engine ← infra ← ui` （app は組み立て）。
- core は純粋関数のみ。engine は core+Port のみを参照し、ブラウザ API を知らない。

## ドメイン仕様（core）

- 型: BrushKind/PatternId/BrushSettings、StrokeKind、Point(x,y,t)、Stroke(id/kind/brush/points)、Drawing(width/height/strokes)。
- Drawing 操作: `startStroke` で新規ストローク追加、`appendPoint` でポイント追記、`clearDrawing` で全消去。すべて純粋関数。
- ぷるぷるノイズ:
  - **時間の概念**:
    - `elapsedTimeMs`: エンジン開始からの経過時間（ミリ秒）。すべてのストロークで共通の値。アニメーションループで更新され、時間経過に応じた揺れを生成する。
    - `point.t`: そのストローク開始からの経過時間（ミリ秒）。ストロークごとに異なる値。ストローク内の各点が個別に揺れるために使用。
  - `computeJitter(Point, elapsedTimeMs, JitterConfig)`: ペン用。`point.t`（ストローク内の時間）と`elapsedTimeMs`の両方を使い、各点が個別に揺れる。
  - 消しゴムは jitter を適用しない。
  - `computePatternJitter(Point, elapsedTimeMs, JitterConfig)`: パターン用。`point.t`を使わず座標と`elapsedTimeMs`のみで計算。ストロークの描画位置に jitter を適用し、同じ座標には同じ jitter が適用される（同じ`elapsedTimeMs`の時点で）。異なるストロークでもパターンがずれない。
- パターン: `PatternTile` と `PatternDefinition`。`getPatternDefinition` で id→ 定義取得（例: dots）。パターンタイルは静的で、時間による歪みは適用しない。`computePatternJitter`でストロークの描画位置をずらすことで、パターンの境界がうねうね揺れる。
- 履歴: `History<T>` で past/present/future を保持。`create/push/undo/redoHistory` を提供。Drawing に適用。

## エンジン層（engine）

- Ports:
  - DrawingRenderer(clear/renderStroke/invalidateRenderCache)
  - TimeProvider(now)
  - RafScheduler(request/cancel)
  - GifEncoder(begin/addFrame/finish)
  - StrokeSound(onStrokeStart/Update/End)
- renderScheduler: `renderDrawingAtTime({ drawing, drawingRevision, renderer, jitterConfig, elapsedTimeMs })` で任意時刻の描画を共通化。`elapsedTimeMs`はエンジン開始からの経過時間（ミリ秒）。
- WigglyEngine:
  - History<Drawing> を保持し、tool/color/width の現在値を管理。
  - pointerDown/move/up で core を更新し、stroke 完了時のみ履歴に push。
  - Drawing の更新ごとに `drawingRevision` を増加させる。
  - RAF ループで `renderDrawingAtTime` を呼ぶ。
  - Undo/Redo/clear を公開。
  - StrokeSound に速度/長さ情報を通知。
- GIF 出力: `exportDrawingAsGif` が offscreen renderer + GifEncoder でフレームを積み、Blob を返す。

## インフラ層（infra）

- CanvasRenderer: ImageDataBuffer にピクセル単位で描画し、ImageBitmap を生成して描画する。パターンは `PatternTile` で計算し、jitter による揺れのみ適用。DPR 対応。
- その他: RealTimeProvider（performance.now）、BrowserRafScheduler（requestAnimationFrame）、WebAudioStrokeSound（Web Audio API による動的音源生成）、UISoundManager（Howler.js による UI 音源管理）、GIF エンコーダー実装（ライブラリラップ）。

## UI 層

- `createWigglyEngine` が canvas・初期 Drawing を受け取り、Renderer/Time/Raf/Sound を注入してエンジン生成（`src/infra/createWigglyEngine.ts`）。
- React `WigglyEditor`（例）: ツール切替ボタン、カラーパレット、太さスライダー、キャンバス。pointerdown/move/up を engine に渡し、マルチタッチ時は描画を無効化。touchAction は `pan-x pan-y pinch-zoom` でピンチズームを許可。

## アニメーション/モーション指針

- 線の揺れ: 振幅 0.5〜2px 程度、1〜2 秒周期のなめらかな揺れ。太さに応じて調整。
- パターンのゆらぎ: タイルを subtle に歪ませる（デフォルト amp ≒0.5px）。模様の位置はキャンバス原点基準で固定。
- UI モーション: ボタン押下で軽い縮小。ツール切替インジケータや GIF 保存トーストはフェード/スライド等の軽いアニメ。

## サウンド指針

- 目的: 描画の触感を補強。ペン設置で再生開始、描画速度でボリューム・周波数変化、終了でフェードアウト。モバイルの自動再生制約に留意。
- UI 要素の音源: DS ボタン、UI ボタン、カラー選択、スライダー操作時に短い SE を再生。Howler.js を使用して管理。
  - 音源ファイル: `public/audios/se/select1.mp3` をほぼすべての UI 要素に使用。Undo は `kero1.wav`、Redo は `kero5.wav` を使用。
- キャンバス描画音: Web Audio API を使用した動的音源生成。
  - ピンクノイズをベースに、ツール（ペン/ブラシ/消しゴム）ごとに異なるフィルター設定で音色を生成。
  - 描画速度（移動平均速度）に応じてリアルタイムに音量と周波数を調整。
  - バンドパスフィルター + ローパスフィルター（8kHz 以上をカット）でプツプツノイズを抑制。
- 詳細は `docs/audio-implementation.md` を参照。

## 開発ポリシー

- TypeScript strict、Biome。純粋関数を core に集約。Magic number は設定経由で管理。高 DPI 対応。Undo 前提で全消し確認は省略可。
