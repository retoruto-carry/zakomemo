"use client";

import { useEffect, useState } from "react";
import { uiSoundManager } from "@/infra/sound/uiSounds";
import { shareToTwitter } from "@/lib/share";

// X（Twitter）アイコン
/** Xアイコン */
const XIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/** ShareButtonの入力 */
interface ShareButtonProps {
  /** シェアするテキスト */
  text: string;
  /** シェアする画像のURL（data URL または blob URL） */
  imageUrl?: string;
  /** クラス名 */
  className?: string;
}

/**
 * X (Twitter) シェアボタン
 * Web Share API対応ブラウザ（主にモバイル）では画像付きの共有を試みます。
 * 非対応の環境では、テキスト共有のインテントURLを開きます。
 */
export function ShareButton({
  text,
  imageUrl,
  className = "",
}: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  // エラー表示を3秒後にリセット
  useEffect(() => {
    if (shareError) {
      const timer = setTimeout(() => setShareError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [shareError]);

  /** シェア処理を実行する */
  const handleShare = async () => {
    if (isSharing) return;
    uiSoundManager.play("share-button", { stopPrevious: true });
    setIsSharing(true);
    setShareError(false);

    try {
      await shareToTwitter({
        text,
        imageUrl,
        imageName: "wiggly-zakomemo.gif",
      });
    } catch (error) {
      console.error("Share failed:", error);
      setShareError(true);
    } finally {
      setIsSharing(false);
    }
  };

  const buttonText = shareError ? "シェア失敗..." : "シェアする";

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={isSharing}
      className={`
        bg-black text-white 
        border-t-[3px] border-l-[3px] border-t-[var(--color-zako-border)] border-l-[var(--color-zako-border)] 
        border-b-[3px] border-r-[3px] border-b-[var(--color-zako-black)] border-r-[var(--color-zako-black)] 
        rounded-[6px] py-2.5 px-4
        flex items-center justify-center gap-2
        active:translate-y-0.5 transition-all 
        font-black text-lg
        disabled:opacity-50 disabled:pointer-events-none
        cursor-pointer
        ${className}
      `}
    >
      <XIcon />
      <span>{buttonText}</span>
    </button>
  );
}
