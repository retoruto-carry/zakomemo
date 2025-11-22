# Repository Guidelines

## Project Structure & Modules
- `src/core/` 純粋ロジック（型・履歴・jitter・patterns）。
- `src/engine/` アプリロジック（WigglyEngine、ports、frameRenderer）。
- `src/infra/` ブラウザ依存実装（CanvasRenderer, Howler, GIF encoder, color utils）。
- `src/ui/` React コンポーネント、`src/app/` Next.js 配線。
- `docs/` 仕様・実装計画。`public/` に静的アセット（音源など）を置く。

## Build, Test, Development
- `pnpm dev` : Next.js 開発サーバ。
- `pnpm build` : 本番ビルド（Turbopack）。
- `pnpm lint` : Biome で静的解析。
- `pnpm format` : Biome フォーマット。
- `pnpm test` : Vitest 実行。
- `pnpm typecheck` : `tsc --noEmit` 型チェック。

## Coding Style & Naming
- TypeScript strict。インデントは2スペース（Biome準拠）。
- ファイル命名は PascalCase クラス、camelCase 関数/変数。型/インターフェースは PascalCase。
- 絶対インポートは `@/` エイリアスを使用。
- 直接 DOM 操作は infra 層まで。core は純粋関数に徹する。

## Testing Guidelines
- フレームワーク: Vitest。グローバルAPIは `tsconfig` の `vitest/globals` を利用。
- テスト配置: 実装ファイルと同階層の `*.test.ts`。
- 新規ロジックはユニットテストを追加し、`pnpm test` が通ること。

## Commit & Pull Request
- コミット例（実績より）: `tool: ペンの圧力/ノイズバリアントを削除`, `perf: パターンキャッシュと描画間引きで負荷軽減` のように、プレフィックス＋簡潔説明。
- PR では概要・動作確認手順・関連Issueを記載。UI変更は可能ならスクリーンショットやGIFを添付。
- 作業前後に `pnpm lint` `pnpm test` `pnpm typecheck` を推奨。

## Architecture Tips
- 依存方向: `core ← engine ← infra ← ui`（appで配線）。coreは副作用禁止。
- パターン描画は CanvasPattern でワールド座標固定、jitterはパターン以外に適用。
- 音源は `public/sounds/` に配置し、Howlerが参照。

## Agent Notes
- 既存のコミットメッセージ・スタイルに合わせること。
- マジックナンバーは設定/定数化する。パフォーマンス変更時は実測確認とコメントを短く残す。
