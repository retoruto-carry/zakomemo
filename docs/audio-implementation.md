# 音源実装のベストプラクティス

## 概要

このドキュメントでは、wiggly-ugomemo における音源実装の方針とベストプラクティスを説明します。

## 技術選定

### Howler.js vs Web Audio API

**Howler.js を採用する理由:**

1. **既存実装との一貫性**: プロジェクトで既に Howler.js を使用しており、`HowlerStrokeSound`が実装済み
2. **シンプルな API**: 直感的なメソッドで音声の再生、停止、ループなどを制御可能
3. **クロスブラウザ対応**: 幅広いブラウザで動作が保証されている
4. **複数音源管理**: 複数の音声ファイルを同時に管理・再生できる
5. **パフォーマンス**: Web Audio API を内部で使用しており、パフォーマンスも良好

**Web Audio API の使用ケース:**

- プロシージャルな音声生成が必要な場合（例: ノイズ生成、リアルタイムエフェクト）
- 高度な音声加工が必要な場合
- 現時点では、既存音源を使用する方針のため、Web Audio API は使用しない

### 既存音源 vs プロシージャル生成

**既存音源を採用する理由:**

1. **実装の簡潔性**: 音源ファイルを配置するだけで使用可能
2. **品質の安定性**: 録音済みの音源は品質が安定している
3. **開発効率**: プロシージャル生成の調整に時間をかける必要がない
4. **ファイルサイズ**: 適切に圧縮された音源ファイルは十分に小さい

**プロシージャル生成の使用ケース:**

- ファイルサイズを極限まで削減したい場合
- 動的に音を変化させたい場合（例: スライダーの値に応じて周波数を変化）
- 現時点では、既存音源を使用する方針

## 実装方針

### 1. UI 要素の音源

**対象:**

- DS 本体のボタン（A, B, X, Y, 十字キー, Start, Select）
- UI 上のボタン（設定、Undo/Redo、ツール切り替えなど）
- カラーパレットの色選択

**実装方法:**

- 各要素に短い SE（Sound Effect）を割り当て
- クリック/タップ時に即座に再生
- 連続クリック時は前の音を停止して新しい音を再生

**音源ファイル:**

- `select1.mp3`: DS ボタン、カラー選択、キャンバス描画に使用
- `cat1.mp3`: UI ボタン（Undo/Redo/Clear/Settings/Tool/Export）、スライダーに使用
- 将来的には各要素に異なる音源を割り当て可能

### 2. キャンバス描画音

**対象:**

- ペン描画
- ブラシ（パターン）描画
- 消しゴム

**実装方法:**

- 既存の`HowlerStrokeSound`を拡張
- ツールごとに異なる音源をロード
- 描画速度に応じてボリュームを調整（既存実装を継承）
- 描画開始時にフェードイン、終了時にフェードアウト

**音源ファイル:**

- 初期実装では `public/audios/se/select1.mp3` をすべてのツールで使用
- 将来的には各ツールに異なる音源を割り当て可能（例: ペン用、ブラシ用、消しゴム用）

### 3. スライダー音

**対象:**

- 太さスライダー
- 揺れ具合スライダー（振幅、周波数）

**実装方法:**

- 値の変化時に短い SE を再生
- `throttle`を使用して再生頻度を制限（例: 100ms ごと）
- 連続操作中は前の音を停止して新しい音を再生

**音源ファイル:**

- 初期実装では `public/audios/se/cat1.mp3` を使用

## 実装パターン

### 音源管理システム

```typescript
// src/infra/UISoundManager.ts
export class UISoundManager {
  private sounds: Map<string, Howl> = new Map();

  // 音源を登録
  registerSound(id: string, src: string): void;

  // 音を再生
  play(id: string, options?: PlayOptions): void;

  // 音を停止
  stop(id: string): void;
}
```

### UI 要素への音源割り当て

```typescript
// ボタンクリック時に音を再生
const soundManager = new UISoundManager();
soundManager.registerSound("button-click", "/audios/se/select1.mp3");

button.addEventListener("click", () => {
  soundManager.play("button-click");
});
```

### スライダー音の実装

```typescript
// throttleを使用して再生頻度を制限
const playSliderSound = throttle(() => {
  soundManager.play("slider-change");
}, 100);

slider.addEventListener("input", () => {
  playSliderSound();
});
```

## パフォーマンス考慮事項

1. **音源のプリロード**: 初回使用時に遅延が発生しないよう、必要な音源を事前にロード
2. **同時再生数の制限**: 同時に再生できる音源数を制限（例: 最大 5 つ）
3. **音源の再利用**: 同じ音源を複数回再生する場合は、Howl インスタンスを再利用
4. **メモリ管理**: 使用されていない音源は適切に破棄

## アクセシビリティ

1. **音量調整**: ユーザーが音量を調整できる UI を提供（将来実装）
2. **音源の無効化**: ユーザーが音を無効にできる設定を提供（将来実装）
3. **視覚的フィードバック**: 音だけでなく、視覚的なフィードバックも提供

## 参考資料

- [Howler.js 公式ドキュメント](https://howlerjs.com/)
- [Web Audio API - MDN](https://developer.mozilla.org/ja/docs/Web/API/Web_Audio_API)
- [ブラウザの自動再生ポリシー - MDN](https://developer.mozilla.org/ja/docs/Web/Media/Guides/Autoplay)
