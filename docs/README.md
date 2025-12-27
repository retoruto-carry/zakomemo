# Zakomemo ドキュメント

## ドキュメント一覧

### 仕様・設計

- **[spec.md](./spec.md)**: プロジェクトの仕様書（機能要件、技術仕様、アーキテクチャ）
- **[pixel-art-design.md](./pixel-art-design.md)**: ピクセルアート化の設計ドキュメント（実装済み）

### 実装詳細

- **[rendering-system.md](./rendering-system.md)**: 描画システムとキャッシュの仕組み（概念的な説明）
- **[audio-implementation.md](./audio-implementation.md)**: 音声実装の詳細

### アルゴリズム・パフォーマンス

- **[bresenham-algorithm.md](./bresenham-algorithm.md)**: Bresenhamアルゴリズムの詳細解説
- **[pixel-art-performance.md](./pixel-art-performance.md)**: パフォーマンス分析と最適化状況

## ドキュメントの読み方

1. **新規開発者**: `spec.md` → `pixel-art-design.md` → `rendering-system.md` の順に読む
2. **キャッシュシステムの理解**: `rendering-system.md`
3. **アルゴリズムの理解**: `bresenham-algorithm.md`
4. **パフォーマンス最適化**: `pixel-art-performance.md`
