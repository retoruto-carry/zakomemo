"use client";

import type { ReactNode } from "react";

interface LayoutProps {
  canvas: ReactNode;
  tools: ReactNode;
}

export function DesktopLayout({ canvas, tools }: LayoutProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#2c2c2c] p-8 overflow-hidden font-sans">
      {/* Desk Texture / Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      />

      {/* Nintendo DS Console Container */}
      <div className="relative flex flex-col items-center gap-6 p-12 rounded-[3rem] bg-[#f2f2f2] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_-8px_0_rgba(0,0,0,0.1)] border-4 border-[#e0e0e0] max-w-[600px] w-full transform scale-95 sm:scale-100 transition-transform">

        {/* Hinge */}
        <div className="absolute top-1/2 left-0 right-0 h-8 -mt-4 bg-[#d0d0d0] z-0" />

        {/* Top Screen System */}
        <div className="relative z-10 bg-[#1a1a1a] p-8 pb-10 rounded-t-3xl rounded-b-lg shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] w-full flex justify-center">
          {/* Glossy Screen Overlay handled by CSS usually, keeping simple for now */}
          <div className="relative w-full max-w-[480px] aspect-[3/2] bg-white outline outline-4 outline-[#000000] shadow-[0_0_20px_rgba(255,255,255,0.1)] overflow-hidden">
            {canvas}
          </div>

          {/* Speakers (Decorative) */}
          <div className="absolute top-1/2 left-3 -translate-y-1/2 flex flex-col gap-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-[#111] shadow-[inset_0_0_2px_rgba(255,255,255,0.1)]" />
            ))}
          </div>
          <div className="absolute top-1/2 right-3 -translate-y-1/2 flex flex-col gap-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-[#111] shadow-[inset_0_0_2px_rgba(255,255,255,0.1)]" />
            ))}
          </div>
        </div>

        {/* Bottom Screen System (Touch) */}
        <div className="relative z-10 bg-[#e8e8e8] p-6 pt-8 rounded-b-3xl rounded-t-lg shadow-[inset_0_-2px_10px_rgba(0,0,0,0.1)] w-full flex justify-center border border-[#d4d4d4]">
          <div className="relative w-full max-w-[480px] aspect-[3/2] bg-[#f0f0f0] outline outline-2 outline-[#bbbbbb] shadow-[inset_0_2px_5px_rgba(0,0,0,0.05)] overflow-hidden rounded-sm">
            {tools}
          </div>
        </div>

      </div>
    </div>
  );
}
