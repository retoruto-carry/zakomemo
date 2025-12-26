# リファクタリング調査チェックリスト

> 目的: 既存の動作を保持しつつ、責務の分離・キャッシュ制御・描画パイプラインをベストプラクティスに近づける。

## 調査・方針
- [x] 既存の描画フロー（core → engine → infra → ui）を読み直す
- [x] キャッシュ設計（cycle bitmap / LRU / renderCacheEpoch / requestId）の整理
- [x] エンジンの描画スケジュール（renderScheduler）とinfraの責務を再整理
- [x] eraser形状の維持ロジックをスタンプ方式に統一
- [x] スタンプ半径の計算を見直し（偶数/奇数の差分を反映）
- [x] JSDoc/コメントの整備（日本語・プロダクション向け）

## 既存変更（完了済み）
- [x] `frameRenderer` → `renderScheduler` へ命名・責務整理
- [x] jitter適用ロジックを `core/strokeJitter` に移動
- [x] eraserの円/四角/線スタンプを正しく維持する描画へ修正
- [x] キャッシュ設計ドキュメントの整理（`docs/rendering-system.md`）

## 今回のリファクタ対象
- [x] UIからキャッシュ破棄を指示しない（UIは値同期のみ）
- [x] engine/rendererがパレット変更を受け取りキャッシュ無効化を判断
- [x] パレット参照（色インデックス）をstrokeに保持し、色変更で過去ストロークも更新
- [x] `createWigglyEngine` を infra へ移動（依存方向の是正）
- [x] `exportDrawingAsGif` を infra へ移動（DOM依存の是正）
- [x] `engineVersion` を廃止し、Reactのstate/refで自然に同期
- [x] `DrawingRenderer` の拡張API（paletteなど）を型として明示
- [x] 変更に合わせたテスト更新
- [x] ドキュメント更新（path/責務/用語）
- [x] 不要なオプショナル型を精査し必須化
- [x] 主要公開APIのJSDocを整理（日本語・簡潔）
- [x] 相対インポートを @/ エイリアスに統一（CSSモジュール除外）
- [x] カスタムパレットのクリック選択と色変更の伝播を整理
- [x] eraserプレビューの分岐をswitch + exhaustiveで整理

## チェック観点（ベストプラクティス）
- [x] engine/infraの責務境界が明確か
- [x] private/publicの可視性が妥当か
- [x] 純粋関数化できる処理は分離されているか
- [x] UIがレンダリング内部の事情に依存していないか
- [x] キャッシュ無効化の条件が1箇所に集約されているか
- [x] 任意指定が必要な箇所のみオプショナル化されているか

## 追加確認メモ
- [x] 既存のテストが通ることを確認（format/lint/typecheck/test）
- [x] 変更後に同様のテストが通ることを確認
- [x] Docstring Coverageの警告が解消されているか確認（98.39%）
