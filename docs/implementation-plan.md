# 実装計画チェックリスト

このリストは作業の進行に合わせて更新する。

- [x] docs/ 作成と仕様書ドラフト追加

## フェーズ1: core 実装 & テスト
- [x] `core/types.ts` 型定義
- [x] `core/drawingLogic.ts`（start/append/clear）実装 + 単体テスト
- [x] `core/jitter.ts` 実装 + テスト
- [x] `core/patternTypes.ts` / `core/patterns.ts` 定義 + テスト
- [x] `core/patternDeform.ts` 実装 + テスト
- [x] `core/history.ts` 実装 + undo/redo テスト
- [x] テスト実行で green を確認

## フェーズ2: engine 実装 & テスト
- [x] `engine/ports.ts` ポート定義
- [x] `engine/frameRenderer.ts`
- [x] `engine/WigglyEngine.ts`
- [x] `engine/exportGif.ts`（モック GifEncoder を含む） 
- [x] engine レイヤーの単体テスト

## フェーズ3: infra 最小実装 & シンプル UI
- [x] `infra/CanvasRenderer`（pattern なし・erase 対応）
- [x] `infra/RealTimeProvider` / `infra/BrowserRafScheduler`
- [x] `app/createWigglyEngine` で初期化
- [x] React UI（描画・ぷるぷる動作確認）

## フェーズ4: パターン & ゆらぎ導入
- [x] CanvasRenderer に pattern brush + `wigglePatternTile` 対応
- [ ] パフォーマンス確認（タイルサイズ調整など）

## フェーズ5: サウンド
- [ ] `infra/HowlerStrokeSound` 実装
- [ ] `createWigglyEngine` で sound を注入

## フェーズ6: モバイル & Undo ジェスチャ
- [x] Pointer Events 統一・`touchAction: "none"` 設定
- [x] 2本指タップ Undo 実装
- [ ] スマホ実機確認

## フェーズ7: GIF 出力
- [x] GifEncoder 実装/ラップ
- [x] オフスクリーン renderer の `getImageData` サポート
- [x] UI に「GIF 保存」導線追加

## フェーズ8: リファクタ & ドキュメント
- [ ] ディレクトリ/設定整備（tsconfig/eslint/prettier）
- [ ] README / ドキュメント更新
- [ ] 最終確認（ビルド・テスト）

## メモ・未対応
- パフォーマンス確認（特に pattern wiggle / jitter の負荷）
- サウンドアセット `public/sounds/draw-loop.mp3` の配置
