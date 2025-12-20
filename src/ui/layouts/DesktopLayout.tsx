"use client";

import type { ReactNode } from "react";

interface LayoutProps {
  canvas: ReactNode;
  tools: ReactNode;
}

export function DesktopLayout({ canvas, tools }: LayoutProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#1a1a1a] p-4 overflow-hidden font-sans text-slate-900">
      {/* Table Surface */}
      <div className="absolute inset-0 bg-[#2c2c2c] opacity-40 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "30px 30px" }}
      />

      {/* Nintendo DSi - Realistic Body */}
      <div className="relative flex flex-col items-center gap-0 rounded-[3rem] bg-[#f2f2f2] shadow-[0_50px_100px_rgba(0,0,0,0.8),inset_0_-4px_10px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.1)] w-[900px] shrink-0 transform transition-transform duration-500 overflow-hidden border-b-[6px] border-[#d9d9d9]">

        {/* Top Shell */}
        <div className="w-full bg-[#f2f2f2] p-8 pb-10 flex flex-col items-center relative">
          {/* Speaker Holes (Left) */}
          <div className="absolute left-[10%] top-[45%] flex flex-col items-center justify-center gap-1.5 opacity-40">
            <div className="flex gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /></div>
            <div className="flex gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /></div>
            <div className="flex gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /></div>
          </div>

          {/* Top Screen System */}
          <div className="relative w-full max-w-[540px] aspect-3/2 bg-[#2a2a2a] rounded-sm p-2 shadow-[inset_0_1px_8px_rgba(0,0,0,0.8)] border-[2px] border-[#333]">
            {/* Glossy Screen */}
            <div className="relative w-full h-full bg-white shadow-[0_0_40px_rgba(255,255,255,0.05)] overflow-hidden rounded-[2px]">
              {canvas}
            </div>
          </div>

          {/* Speaker Holes (Right) */}
          <div className="absolute right-[10%] top-[45%] flex flex-col items-center justify-center gap-1.5 opacity-40">
            <div className="flex gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /></div>
            <div className="flex gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /></div>
            <div className="flex gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /><div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" /></div>
          </div>
        </div>

        {/* Hinge Mechanism */}
        <div className="w-full h-12 bg-linear-to-b from-[#e8e8e8] via-[#f2f2f2] to-[#e0e0e0] relative flex items-center justify-center border-y border-[#ccc] z-20">
          {/* Status LEDs (Left side of the hinge cylinder) */}
          <div className="absolute left-[12%] top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full border border-white/20">
            <div className="w-1.5 h-3 rounded-full bg-[#4fc3f7] shadow-[0_0_5px_#03a9f4]" title="Wireless" />
            <div className="w-1.5 h-3 rounded-full bg-[#ffb74d] opacity-20" title="Charge" />
            <div className="w-1.5 h-3 rounded-full bg-[#81c784] shadow-[0_0_5px_#4caf50]" title="Power" />
          </div>

          {/* Internal Camera */}
          <div className="w-7 h-7 rounded-full bg-[#0a0a0a] border-[3px] border-[#ddd] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] flex items-center justify-center relative">
            <div className="w-2.5 h-2.5 rounded-full bg-linear-to-tr from-[#001] to-[#113]" />
            {/* Mic hole - moved right next to camera */}
            <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#888] shadow-inner" />
          </div>
        </div>

        {/* Bottom Shell */}
        <div className="w-full bg-[#f2f2f2] p-8 pt-6 flex items-center justify-center gap-6 relative border-t border-white/50">

          {/* Left: D-pad & Power */}
          <div className="flex flex-col items-end gap-10">
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* D-pad Socket (Perfectly matching body color, no shadow) */}
              <div className="absolute w-[110%] h-[110%] rounded-full bg-[#f2f2f2]" />

              {/* D-pad Cross (Unified shape using clip-path for correct shadow) */}
              <div
                className="relative w-[85%] h-[85%]"
                style={{
                  filter: 'drop-shadow(1px 0 0 #ccc) drop-shadow(-1px 0 0 #ccc) drop-shadow(0 1px 0 #ccc) drop-shadow(0 -1px 0 #ccc) drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
              >
                <div
                  className="w-full h-full bg-[#fdfdfd]"
                  style={{
                    clipPath: "polygon(34% 0%, 66% 0%, 66% 34%, 100% 34%, 100% 66%, 66% 66%, 66% 100%, 34% 100%, 34% 66%, 0% 66%, 0% 34%, 34% 34%)"
                  }}
                />

                {/* Visual D-pad Details */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* Directional marks */}
                  <div className="absolute top-2 w-0 h-0 border-l-4 border-r-4 border-b-6 border-l-transparent border-r-transparent border-b-[#999] opacity-60" />
                  <div className="absolute bottom-2 w-0 h-0 border-l-4 border-r-4 border-t-6 border-l-transparent border-r-transparent border-t-[#999] opacity-60" />
                  <div className="absolute left-2 w-0 h-0 border-t-4 border-b-4 border-r-6 border-t-transparent border-b-transparent border-r-[#999] opacity-60" />
                  <div className="absolute right-2 w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent border-l-[#999] opacity-60" />
                </div>
              </div>
            </div>

            {/* Power Button */}
            <div className="flex items-center gap-2 -mt-2 pr-2">
              <span className="text-[9px] font-black text-[#aaa] tracking-[0.1em]">POWER</span>
              <button className="w-7 h-7 rounded-full bg-[#fdfdfd] border border-[#ccc] shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_2px_white] active:scale-90 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full border border-[#999] relative">
                  <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-[#999]" />
                </div>
              </button>
            </div>
          </div>

          {/* Center: Bottom Screen System */}
          <div className="shrink-0 relative w-full max-w-[540px] aspect-3/2 bg-[#2a2a2a] rounded-sm p-2 shadow-[inset_0_1px_8px_rgba(0,0,0,0.8)] border-[2px] border-[#333]">
            <div className="relative w-full h-full bg-[#fdfdfd] shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] overflow-hidden rounded-[2px]">
              {tools}
            </div>
          </div>

          {/* Right: A/B/X/Y & Start/Select */}
          <div className="flex flex-col items-start gap-10">
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Buttons Socket (Perfectly matching body color, no shadow) */}
              <div className="absolute w-[110%] h-[110%] rounded-full bg-[#f2f2f2]" />

              {/* Diamond Layout Buttons */}
              <div className="relative w-full h-full grid grid-cols-3 grid-rows-3 p-1">
                <button className="col-start-2 row-start-1 w-10 h-10 rounded-full bg-[#fdfdfd] border border-[#ccc] shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-px flex items-center justify-center font-bold text-[#888]">X</button>
                <button className="col-start-1 row-start-2 w-10 h-10 rounded-full bg-[#fdfdfd] border border-[#ccc] shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-px flex items-center justify-center font-bold text-[#888]">Y</button>
                <button className="col-start-3 row-start-2 w-10 h-10 rounded-full bg-[#fdfdfd] border border-[#ccc] shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-px flex items-center justify-center font-bold text-[#888]">A</button>
                <button className="col-start-2 row-start-3 w-10 h-10 rounded-full bg-[#fdfdfd] border border-[#ccc] shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-px flex items-center justify-center font-bold text-[#888]">B</button>
              </div>
            </div>

            {/* START/SELECT (Vertical align) */}
            <div className="flex flex-col gap-4 pl-1 -mt-2">
              <div className="flex items-center gap-2">
                <button className="w-5 h-5 rounded-full bg-[#fdfdfd] border border-[#ccc] shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:scale-90" />
                <span className="text-[8px] font-black text-[#bbb] tracking-tighter">START</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-5 h-5 rounded-full bg-[#fdfdfd] border border-[#ccc] shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:scale-90" />
                <span className="text-[8px] font-black text-[#bbb] tracking-tighter">SELECT</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
