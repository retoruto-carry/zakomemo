# 音源実装のベストプラクティス

## 概要

このドキュメントでは、zakomemo における音源実装の方針とベストプラクティスを説明します。

## 調査結果: 描画音の実装事例

業界の一般的な実装方法を調査した結果、以下の手法が効果的であることが確認されました：

1. **短いシームレスループ音の使用**

   - 100-200ms 程度の非常に短いノイズ音をシームレスにループ再生
   - 長い効果音をループすると不自然に聞こえるため、専用の短いループ音源が必要

2. **Web Audio API による動的生成**

   - ホワイトノイズやピンクノイズをベースに、フィルターやエンベロープで描画音を生成
   - 描画速度や筆圧に応じてリアルタイムに音色を変化させることが可能

3. **ツールごとの音の差別化**
   - ペン、ブラシ、消しゴムなど、各ツールに固有の音を割り当てることで、直感的な操作感を実現

参考: ゲーム開発やデジタルアートツールでは、インタラクティブな音響演出や動的生成・合成技術が重要視されています。

## 技術選定

### Howler.js vs Web Audio API

**使い分け:**

- **Howler.js**: UI 要素の音源（ボタン、スライダー、カラー選択など）に使用

  - シンプルな API で音声ファイルの再生を管理
  - 複数の音源を同時に管理・再生できる
  - クロスブラウザ対応が良好

- **Web Audio API**: キャンバス描画音に使用
  - プロシージャルな音声生成（ピンクノイズの動的生成）
  - リアルタイムエフェクト（フィルター、音量・周波数の動的調整）
  - 描画速度に応じた音色の変化を実現

### 既存音源 vs プロシージャル生成

**使い分け:**

- **既存音源（Howler.js）**: UI 要素の音源に使用

  - 実装が簡潔で、音源ファイルを配置するだけで使用可能
  - 品質が安定している
  - ファイルサイズは適切に圧縮された音源ファイルで十分に小さい

- **プロシージャル生成（Web Audio API）**: キャンバス描画音に使用
  - ファイルサイズを削減（音源ファイル不要）
  - 描画速度に応じてリアルタイムに音色を変化させる
  - ツールごとに異なる音色を動的に生成

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

**音源ファイル（`public/audios/se/`）:**

- `select1.mp3`: ほぼすべての UI 要素に使用
  - DS ボタン（A, B, X, Y, 十字キー, Start, Select）
  - UI ボタン（Clear, Settings, Tool, Export）
  - カラー選択、パレット選択
  - スライダー
  - 設定モーダル（タブ、閉じる）
  - エクスポートモーダル（閉じる、保存）
  - シェアボタン
  - ポップアップ閉じる
- `kero1.wav`: Undo ボタンに使用
- `kero5.wav`: Redo ボタンに使用
- 将来的には各要素に異なる音源を割り当て可能

### 2. キャンバス描画音

**対象:**

- ペン描画
- ブラシ（パターン）描画
- 消しゴム

**実装方法:**

- Web Audio API を使用した動的音源生成を実装
- ピンクノイズを AudioWorklet で生成（未対応環境はバッファループにフォールバック）
- 描画速度に応じて音量とフィルター周波数を調整（指数平滑化）
- ツールごとに異なるフィルター設定とゲインを適用

**技術詳細:**

1. **ノイズ生成**

   - すべてのツール: ピンクノイズ（より自然な音色）
   - AudioWorklet が使える場合は `pink-noise-processor` を動的生成
   - 未対応環境では 8 秒のループバッファを生成し、クロスフェードで継ぎ目を抑制

2. **フィルター設定**

   - ペン: バンドパス（2800Hz、Q: 0.6）+ ハイパス（60Hz）
   - ブラシ（パターン）: バンドパス（2400Hz、Q: 0.4）+ ハイパス（60Hz）
   - 消しゴム: バンドパス（4000Hz、Q: 0.5）+ ハイパス（90Hz）
   - 全ツール共通: ローパス（8kHz）で高域のノイズを抑制

3. **動的パラメータ調整**

   - 速度は指数平滑化（時定数 0.08s）し、`SPEED_REFERENCE` を基準に正規化
   - フィルター周波数は平方根カーブで 0.9〜2.1 倍程度に変化（ツールごとに上限が異なる）
   - 音量は `minGain + speed * gainScale` を基準にし、ヒステリシス付きゲートで停止付近を無音化

4. **フェード制御**

   - 描画開始時: 20ms でフェードイン
   - 描画終了時: 50ms でフェードアウト
   - ツール切り替え時: 50ms でフェードアウト
   - 入力停止時は idle 判定で段階的に無音化し、約 220ms でソースを停止

5. **フィルターチェーン**
   - `source → highpass → bandpass → lowpass → gain → destination`
   - バンドパスでツールごとの音色を決定し、低域/高域ノイズを抑える

**実装クラス:**

- `WebAudioStrokeSound`: Web Audio API を使用した描画音生成クラス
- `src/infra/sound/WebAudioStrokeSound.ts` に実装
- 代替実装として `src/infra/sound/HowlerStrokeSound.ts` も用意（UI音源と同じSEのループ）

**音源ファイルの探し方:**

フリーで商用利用可能な描画音源を探す際の検索キーワード：

**日本語サイト:**

- 「ループ可能 効果音 無料 商用利用」
- 「描画音 ループ フリー 商用利用可能」
- 「シームレスループ 音源 フリー 商用利用可能」
- 「短いループ音源 無料 商用利用」
- 「ペン 筆記音 効果音 フリー」
- 「ブラシ 塗り 効果音 ループ」

**英語サイト:**

- "pen writing sound loop seamless"
- "brush stroke sound effect loop"
- "eraser sound loop free commercial use"
- "drawing sound effect seamless loop"
- "white noise pink noise loop short"
- "pen scratch sound loop"

**おすすめのフリー音源サイト（商用利用可能）:**

1. **Freesound.org** (https://freesound.org/)

   - Creative Commons ライセンスの音源が豊富
   - 検索時にライセンスフィルターで「Commercial use allowed」を選択
   - キーワード: "pen", "brush", "eraser", "writing", "drawing", "loop", "scratch"

2. **Pixabay** (https://pixabay.com/sound-effects/)

   - Pixabay License（商用利用可能、クレジット不要）
   - 高品質な音源が多数
   - キーワード: "pen writing", "brush stroke", "eraser", "drawing"

3. **Zapsplat** (https://www.zapsplat.com/)

   - 無料アカウント登録で商用利用可能
   - プロフェッショナルな音源が多い
   - キーワード: "pen", "brush", "eraser", "drawing", "writing"

4. **SOUNDICONS** (https://soundicons.net/)

   - 日本語サイト、商用利用可能
   - ゲーム向け効果音が豊富
   - 約 2500 種類の電子音の効果音がデータベース化

5. **Springin' Sound Stock** (https://www.springin.org/sound-stock/)

   - 日本語サイト、商用利用可能
   - ゲーム向け効果音、600 点以上の素材

6. **DOVA-SYNDROME** (https://dova-s.jp/)
   - 日本語サイト、商用利用可能
   - BGM 中心だが効果音もあり

**音源の選び方:**

- 100-200ms 程度の短い音源を選ぶ
- ループ時に不自然にならないよう、開始と終了が滑らかに繋がる音源を選ぶ
- 必要に応じて、Audacity などの無料ソフトで音源を編集して短くする
- 各ツール（ペン、ブラシ、消しゴム）ごとに異なる音源を用意する
- シームレスループを作るには、音源の最初と最後の波形が似ているものを選ぶ

### 3. スライダー音

**対象:**

- 太さスライダー
- 揺れ具合スライダー（振幅、周波数）

**実装方法:**

- 値の変化時に短い SE を再生
- `throttle`を使用して再生頻度を制限（例: 100ms ごと）
- 連続操作中は前の音を停止して新しい音を再生

**音源ファイル:**

- `select1.mp3` を使用（UI 要素と統一）

## 実装パターン

### 音源管理システム

```typescript
// src/infra/sound/UISoundManager.ts
export class UISoundManager {
  private sounds: Map<string, Howl> = new Map();

  // 音源を登録
  registerSound(
    id: string,
    src: string | string[],
    options?: { volume?: number; preload?: boolean },
  ): void;

  // 音を再生
  play(id: string, options?: PlayOptions): number | null;

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
