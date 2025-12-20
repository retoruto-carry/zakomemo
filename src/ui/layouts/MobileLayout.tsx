"use client";

import type { ReactNode } from "react";

interface LayoutProps {
  canvas: ReactNode;
  tools: ReactNode;
}

export function MobileLayout({ canvas, tools }: LayoutProps) {
  return (
    <div className="fixed inset-0 flex flex-col bg-[color:var(--color-ugo-bg)] touch-none">
      {/* Top: Canvas Area */}
      {/* 
         Canvas Resolution is 480x320 (3:2).
         On Mobile, we want it full width. 
         Height will be auto based on aspect ratio.
         But we also need space for tools.
         User request: "Top: Big Canvas, Bottom: Big Tools".
         Let's assume Canvas takes priority flex, but preserves aspect ratio?
         Or simpler: Canvas container is 3:2 aspect ratio, width 100%.
         Tools take remaining space.
      */}
      <div className="w-full bg-[#1a1a1a] flex items-center justify-center p-2 shadow-md z-10">
        <div className="relative w-full aspect-[3/2] max-h-[60vh] bg-white rounded-lg overflow-hidden shadow-inner ring-4 ring-[#e0e0e0]">
          {canvas}
        </div>
      </div>

      {/* Bottom: Tools Area */}
      <div className="relative z-0">
        {tools}
      </div>
    </div>
  );
}
