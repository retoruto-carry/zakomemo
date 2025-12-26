import { UISoundManager } from "@/infra/sound/UISoundManager";

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
  const undoSound = "/audios/se/kero1.wav";
  const redoSound = "/audios/se/kero5.wav";

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

  // UIボタン - やり直しボタンのみcat1.mp3、他はselect1.mp3
  uiSoundManager.registerSound("button-undo", undoSound);
  uiSoundManager.registerSound("button-redo", redoSound);
  uiSoundManager.registerSound("button-clear", selectSound);
  uiSoundManager.registerSound("button-settings", selectSound);
  uiSoundManager.registerSound("button-tool", selectSound);
  uiSoundManager.registerSound("button-export", selectSound);

  // カラーパレット - select1.mp3を使用（選択系）
  uiSoundManager.registerSound("color-select", selectSound);

  // スライダー - select1.mp3を使用
  uiSoundManager.registerSound("slider-change", selectSound);

  // キャンバス描画（ツール別）- select1.mp3を使用
  uiSoundManager.registerSound("canvas-pen", selectSound);
  uiSoundManager.registerSound("canvas-pattern", selectSound);
  uiSoundManager.registerSound("canvas-eraser", selectSound);

  // パターン選択 - select1.mp3を使用
  uiSoundManager.registerSound("pattern-select", selectSound);

  // 消しゴム種類選択 - select1.mp3を使用
  uiSoundManager.registerSound("eraser-variant-select", selectSound);

  // 設定モーダルタブ - select1.mp3を使用
  uiSoundManager.registerSound("settings-tab", selectSound);

  // 設定モーダル閉じる - select1.mp3を使用
  uiSoundManager.registerSound("settings-close", selectSound);

  // パレットプリセット選択 - select1.mp3を使用
  uiSoundManager.registerSound("palette-preset-select", selectSound);

  // カスタムパレット色変更 - select1.mp3を使用
  uiSoundManager.registerSound("custom-palette-color", selectSound);

  // エクスポートモーダル閉じる - select1.mp3を使用
  uiSoundManager.registerSound("export-close", selectSound);

  // エクスポート保存 - select1.mp3を使用
  uiSoundManager.registerSound("export-save", selectSound);

  // シェアボタン - select1.mp3を使用
  uiSoundManager.registerSound("share-button", selectSound);

  // ポップアップ閉じる - select1.mp3を使用
  uiSoundManager.registerSound("popup-close", selectSound);
}
