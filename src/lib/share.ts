/**
 * シェア関連のユーティリティ関数
 */

// デバイス判定
export const isIos = (): boolean =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isAndroid = (): boolean =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

export const isMobile = (): boolean => isIos() || isAndroid();

/**
 * 画像付きの Web Share API が利用可能かを判定
 */
export const canShareFiles = async (): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    const file = new File([], "dummy.png", { type: "image/png" });
    return navigator.canShare?.({ files: [file] }) ?? false;
  } catch {
    return false;
  }
};

/**
 * URL から Blob を取得して File オブジェクトに変換
 */
export const urlToFile = async (
  url: string,
  filename: string,
  mimeType: string,
): Promise<File> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  const blob = await response.blob();
  return new File([blob], filename, { type: mimeType });
};

/**
 * X (Twitter) 用の Intent URL を生成
 * モバイルでは twitter:// スキームを使用
 */
export const createTwitterIntentUrl = (text: string, url?: string): string => {
  const params = new URLSearchParams();
  params.set("text", text);
  if (url) params.set("url", url);

  // モバイルでは twitter:// スキームを優先（アプリが開く）
  if (isMobile()) {
    return `twitter://post?${params.toString()}`;
  }
  return `https://twitter.com/intent/tweet?${params.toString()}`;
};

export interface ShareOptions {
  text: string;
  imageUrl?: string;
  imageName?: string;
  url?: string;
}

/**
 * X (Twitter) でシェア
 * - モバイル + Web Share API 対応: 画像付きでネイティブシェア
 * - それ以外: インテントURLでシェア（モバイルはアプリ、PCはWeb）
 */
export const shareToTwitter = async (options: ShareOptions): Promise<void> => {
  const { text, imageUrl, imageName = "wiggly-ugomemo.gif" } = options;

  // モバイル + 画像あり + Web Share API 対応の場合
  if (isMobile() && imageUrl && (await canShareFiles())) {
    try {
      const file = await urlToFile(imageUrl, imageName, "image/gif");
      await navigator.share({
        text,
        files: [file],
      });
      return;
    } catch (error) {
      // ユーザーがキャンセルした場合は何もしない
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // その他のエラーはインテントにフォールバック
      console.warn("Web Share API failed, falling back to intent:", error);
    }
  }

  // インテントでシェア
  const intentUrl = createTwitterIntentUrl(text, options.url);

  if (isMobile()) {
    // モバイルでは twitter:// を試し、失敗したらWebのURLにフォールバック
    const fallbackParams = new URLSearchParams({ text });
    if (options.url) {
      fallbackParams.set("url", options.url);
    }
    const webFallbackUrl = `https://twitter.com/intent/tweet?${fallbackParams.toString()}`;

    // twitter:// スキームを試す
    window.location.href = intentUrl;

    // 1秒後にまだページにいたらWebのURLにフォールバック
    setTimeout(() => {
      // ページがまだアクティブなら Twitter アプリが開かなかったと判断
      if (document.visibilityState === "visible") {
        window.open(webFallbackUrl, "_blank");
      }
    }, 1000);
  } else {
    // PC は新しいタブで開く
    window.open(intentUrl, "_blank");
  }
};
