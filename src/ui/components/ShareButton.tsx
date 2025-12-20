"use client";

import { useState, useEffect } from "react";
import { shareToTwitter, isMobile, canShareFiles } from "@/lib/share";

// X (Twitter) アイコン
const XIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ShareButtonProps {
  /** シェアするテキスト */
  text: string;
  /** シェアする画像の URL (data URL or blob URL) */
  imageUrl?: string;
  /** クラス名 */
  className?: string;
}

/**
 * X (Twitter) シェアボタン
 * Web Share API対応ブラウザ（主にモバイル）では画像付きの共有を試みます。
 * 非対応の環境では、テキスト共有のインテントURLを開きます。
 */
export function ShareButton({ text, imageUrl, className = "" }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [canShare, setCanShare] = useState<boolean | null>(null);

  // 画像付き Web Share API が使えるかチェック
  useEffect(() => {
    const checkShareCapability = async () => {
      const mobile = isMobile();
      const filesSupported = await canShareFiles();
      setCanShare(mobile && filesSupported);
    };
    checkShareCapability();
  }, []);

  const handleShare = async () => {
    if (isSharing || !imageUrl) return;
    setIsSharing(true);

    try {
      await shareToTwitter({
        text,
        imageUrl,
        imageName: "wiggly-ugomemo.gif",
      });
    } finally {
      setIsSharing(false);
    }
  };

  //// 画像付きシェアができない環境では表示しない
  //if (!canShare || !imageUrl) {
  //  return null;
  //}

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className={`
        bg-black text-white 
        border-t-[3px] border-l-[3px] border-t-[#333] border-l-[#333] 
        border-b-[3px] border-r-[3px] border-b-[#000] border-r-[#000] 
        rounded-[6px] py-2.5 px-4
        flex items-center justify-center gap-2
        active:translate-y-0.5 transition-all 
        font-black text-lg
        disabled:opacity-50 disabled:pointer-events-none
        ${className}
      `}
    >
      <XIcon />
      <span>シェアする</span>
    </button>
  );
}

