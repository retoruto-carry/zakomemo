"use client";

import type { ReactNode } from "react";

/** レイアウトに渡す表示要素 */
interface LayoutProps {
  canvas: ReactNode;
  tools: ReactNode;
}

/** モバイル向けの本体レイアウト */
export function MobileLayout({ canvas, tools }: LayoutProps) {
  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--zako-body-bg)] touch-none transition-colors duration-300">
      {/* 上: キャンバス領域 */}
      <div className="w-full bg-[var(--zako-bezel-bg)] flex items-center justify-center p-2 shadow-md z-10 border-b-2 border-[var(--zako-bezel-border)]">
        <div className="relative w-full aspect-[3/2] max-h-[60vh] bg-white rounded-lg overflow-hidden shadow-inner ring-4 ring-[var(--zako-body-bg)]">
          {canvas}
        </div>
      </div>

      {/* 下: ツール領域 */}
      <div className="relative z-0 bg-[var(--zako-body-bg)] flex-1">
        {tools}
      </div>
    </div>
  );
}
