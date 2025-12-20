"use client";

import type { ReactNode } from "react";

interface LayoutProps {
  canvas: ReactNode;
  tools: ReactNode;
}

export function MobileLayout({ canvas, tools }: LayoutProps) {
  return (
    <div className="fixed inset-0 flex flex-col bg-(--ugo-body-bg) touch-none transition-colors duration-300">
      {/* Top: Canvas Area */}
      <div className="w-full bg-(--ugo-bezel-bg) flex items-center justify-center p-2 shadow-md z-10 border-b-2 border-(--ugo-bezel-border)">
        <div className="relative w-full aspect-[3/2] max-h-[60vh] bg-white rounded-lg overflow-hidden shadow-inner ring-4 ring-(--ugo-body-bg)">
          {canvas}
        </div>
      </div>

      {/* Bottom: Tools Area */}
      <div className="relative z-0 bg-(--ugo-body-bg) flex-1">
        {tools}
      </div>
    </div>
  );
}
