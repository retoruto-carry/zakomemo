import { UISoundManager } from "./UISoundManager";

/**
 * UI音源管理のシングルトンインスタンス
 * アプリ全体で共有される音源管理システム
 */
export const uiSoundManager = new UISoundManager();

/**
 * UI音源の初期化
 * アプリ起動時に呼び出して、すべての音源を登録する
 */
export function initializeUISounds(): void {
  const selectSound = "/audios/se/select1.mp3";
  const catSound = "/audios/se/cat1.mp3";

  // DSボタン - select1.mp3を使用
  uiSoundManager.registerSound("ds-button-a", selectSound);
  uiSoundManager.registerSound("ds-button-b", selectSound);
  uiSoundManager.registerSound("ds-button-x", selectSound);
  uiSoundManager.registerSound("ds-button-y", selectSound);
  uiSoundManager.registerSound("ds-button-up", selectSound);
  uiSoundManager.registerSound("ds-button-down", selectSound);
  uiSoundManager.registerSound("ds-button-left", selectSound);
  uiSoundManager.registerSound("ds-button-right", selectSound);
  uiSoundManager.registerSound("ds-button-start", selectSound);
  uiSoundManager.registerSound("ds-button-select", selectSound);

  // UIボタン - cat1.mp3を使用（操作系のボタン）
  uiSoundManager.registerSound("button-undo", catSound);
  uiSoundManager.registerSound("button-redo", catSound);
  uiSoundManager.registerSound("button-clear", catSound);
  uiSoundManager.registerSound("button-settings", catSound);
  uiSoundManager.registerSound("button-tool", catSound);
  uiSoundManager.registerSound("button-export", catSound);

  // カラーパレット - select1.mp3を使用（選択系）
  uiSoundManager.registerSound("color-select", selectSound);

  // スライダー - cat1.mp3を使用（調整系）
  uiSoundManager.registerSound("slider-change", catSound);

  // キャンバス描画（ツール別）- select1.mp3を使用
  uiSoundManager.registerSound("canvas-pen", selectSound);
  uiSoundManager.registerSound("canvas-pattern", selectSound);
  uiSoundManager.registerSound("canvas-eraser", selectSound);

  // パターン選択 - select1.mp3を使用
  uiSoundManager.registerSound("pattern-select", selectSound);

  // 消しゴム種類選択 - select1.mp3を使用
  uiSoundManager.registerSound("eraser-variant-select", selectSound);

  // 設定モーダルタブ - cat1.mp3を使用
  uiSoundManager.registerSound("settings-tab", catSound);

  // 設定モーダル閉じる - cat1.mp3を使用
  uiSoundManager.registerSound("settings-close", catSound);

  // パレットプリセット選択 - select1.mp3を使用
  uiSoundManager.registerSound("palette-preset-select", selectSound);

  // カスタムパレット色選択 - select1.mp3を使用
  uiSoundManager.registerSound("custom-palette-color", selectSound);

  // エクスポートモーダル閉じる - cat1.mp3を使用
  uiSoundManager.registerSound("export-close", catSound);

  // エクスポート保存 - cat1.mp3を使用
  uiSoundManager.registerSound("export-save", catSound);

  // シェアボタン - cat1.mp3を使用
  uiSoundManager.registerSound("share-button", catSound);

  // ポップアップ閉じる - cat1.mp3を使用
  uiSoundManager.registerSound("popup-close", catSound);
}
