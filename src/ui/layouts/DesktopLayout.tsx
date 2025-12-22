"use client";

import type { ReactNode } from "react";

interface DSButtonHandlers {
  onA: () => void;
  onB: () => void;
  onX: () => void;
  onY: () => void;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  onStart: () => void;
  onSelect: () => void;
}

interface LayoutProps {
  canvas: ReactNode;
  tools: ReactNode;
  dsButtons?: DSButtonHandlers;
}

export function DesktopLayout({ canvas, tools, dsButtons }: LayoutProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#1a1a1a] p-4 overflow-hidden font-sans text-slate-900">
      {/* Table Surface */}
      <div
        className="absolute inset-0 bg-[#2c2c2c] opacity-40 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      {/* Nintendo DSi - Realistic Body */}
      <div className="relative flex flex-col items-center gap-0 rounded-[3rem] bg-(--ugo-body-bg) shadow-[0_50px_100px_rgba(0,0,0,0.8),inset_0_-4px_10px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.1)] w-[650px] shrink-0 transform transition-transform duration-500 overflow-hidden border-b-[6px] border-(--ugo-body-border)">
        {/* Top Shell */}
        <div className="w-full bg-(--ugo-body-bg) p-4 pt-6 pb-6 flex flex-col items-center relative">
          {/* Speaker Holes (Left) */}
          <div className="absolute left-[8%] top-[40%] flex flex-col items-center justify-center gap-1.5 opacity-40">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
          </div>

          {/* Top Screen System */}
          <div className="relative w-full max-w-[420px] aspect-[4/3] bg-(--ugo-bezel-bg) rounded-sm p-2 shadow-[inset_0_1px_8px_rgba(0,0,0,0.8)] border-[2px] border-(--ugo-bezel-border)">
            {/* Glossy Screen */}
            <div className="relative w-full h-full bg-white shadow-[0_0_40px_rgba(255,255,255,0.05)] overflow-hidden rounded-[2px]">
              {canvas}
            </div>
          </div>

          {/* Speaker Holes (Right) */}
          <div className="absolute right-[8%] top-[40%] flex flex-col items-center justify-center gap-1.5 opacity-40">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
          </div>
        </div>

        {/* Hinge Mechanism */}
        <div className="w-full h-10 bg-linear-to-b from-(--ugo-hinge-from) via-(--ugo-hinge-via) to-(--ugo-hinge-to) relative flex items-center justify-center border-y border-(--ugo-hinge-border) z-20">
          {/* Status LEDs (Left side of the hinge cylinder) - decorative only */}
          <div className="absolute left-[12%] top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full border border-white/20">
            <div
              aria-hidden="true"
              className="w-1.5 h-3 rounded-full bg-[#4fc3f7] shadow-[0_0_5px_#03a9f4]"
              title="Wireless"
            />
            <div
              aria-hidden="true"
              className="w-1.5 h-3 rounded-full bg-[#ffb74d] opacity-20"
              title="Charge"
            />
            <div
              aria-hidden="true"
              className="w-1.5 h-3 rounded-full bg-[#81c784] shadow-[0_0_5px_#4caf50]"
              title="Power"
            />
          </div>

          {/* Internal Camera */}
          <div className="w-6 h-6 rounded-full bg-[#0a0a0a] border-[2px] border-(--ugo-hinge-border) shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] flex items-center justify-center relative">
            <div className="w-2 h-2 rounded-full bg-linear-to-tr from-[#001] to-[#113]" />
            {/* Mic hole - moved right next to camera */}
            <div className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#888] shadow-inner" />
          </div>
        </div>

        {/* Bottom Shell */}
        <div className="w-full bg-(--ugo-body-bg) p-4 pt-4 pb-6 flex items-center justify-center gap-2 relative border-t border-white/50">
          {/* Left: D-pad & Power */}
          <div className="flex flex-col items-end gap-6 -mt-2">
            <div className="relative w-[88px] h-[88px] flex items-center justify-center">
              {/* D-pad Socket (Perfectly matching body color, no shadow) */}
              <div className="absolute w-[110%] h-[110%] rounded-full bg-(--ugo-body-bg)" />

              {/* D-pad Cross (Unified shape using clip-path for correct shadow) */}
              <div
                className="relative w-[85%] h-[85%]"
                style={{
                  filter:
                    "drop-shadow(1px 0 0 var(--ugo-body-border)) drop-shadow(-1px 0 0 var(--ugo-body-border)) drop-shadow(0 1px 0 var(--ugo-body-border)) drop-shadow(0 -1px 0 var(--ugo-body-border)) drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                }}
              >
                <div
                  className="w-full h-full bg-(--ugo-button-bg)"
                  style={{
                    clipPath:
                      "polygon(34% 0%, 66% 0%, 66% 34%, 100% 34%, 100% 66%, 66% 66%, 66% 100%, 34% 100%, 34% 66%, 0% 66%, 0% 34%, 34% 34%)",
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

                {/* Clickable regions for D-pad */}
                <button
                  type="button"
                  onClick={dsButtons?.onUp}
                  className="absolute top-0 left-[34%] w-[32%] h-[34%] active:bg-black/5 rounded-t-sm cursor-pointer hover:bg-black/5 transition-colors z-10"
                  aria-label="上"
                />
                <button
                  type="button"
                  onClick={dsButtons?.onDown}
                  className="absolute bottom-0 left-[34%] w-[32%] h-[34%] active:bg-black/5 rounded-b-sm cursor-pointer hover:bg-black/5 transition-colors z-10"
                  aria-label="下"
                />
                <button
                  type="button"
                  onClick={dsButtons?.onLeft}
                  className="absolute top-[34%] left-0 w-[34%] h-[32%] active:bg-black/5 rounded-l-sm cursor-pointer hover:bg-black/5 transition-colors z-10"
                  aria-label="左"
                />
                <button
                  type="button"
                  onClick={dsButtons?.onRight}
                  className="absolute top-[34%] right-0 w-[34%] h-[32%] active:bg-black/5 rounded-r-sm cursor-pointer hover:bg-black/5 transition-colors z-10"
                  aria-label="右"
                />
              </div>
            </div>

            {/* Power Button - Decorative */}
            <div className="flex items-center gap-1.5 -mt-1 pr-1">
              <span className="text-[7px] font-black text-[#aaa] tracking-[0.1em]">
                POWER
              </span>
              <div
                aria-hidden="true"
                className="w-5 h-5 rounded-full bg-(--ugo-button-bg) border border-(--ugo-button-border) shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_2px_white] active:scale-90 flex items-center justify-center"
              >
                <div className="w-2 h-2 rounded-full border border-[#999] relative">
                  <div className="absolute top-[-1.5px] left-1/2 -translate-x-1/2 w-0.5 h-0.5 bg-[#999]" />
                </div>
              </div>
            </div>
          </div>

          {/* Center: Bottom Screen System */}
          <div className="shrink-0 relative w-full max-w-[420px] aspect-[4/3] bg-(--ugo-bezel-bg) rounded-sm p-2 shadow-[inset_0_1px_8px_rgba(0,0,0,0.8)] border-[2px] border-(--ugo-bezel-border)">
            <div className="relative w-full h-full bg-[#fdfdfd] shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] overflow-hidden rounded-[2px]">
              {tools}
            </div>
          </div>

          {/* Right: A/B/X/Y & Start/Select */}
          <div className="flex flex-col items-start gap-6 -mt-2">
            <div className="relative w-[88px] h-[88px] flex items-center justify-center">
              {/* Buttons Socket (Perfectly matching body color, no shadow) */}
              <div className="absolute w-[110%] h-[110%] rounded-full bg-(--ugo-body-bg)" />

              {/* Diamond Layout Buttons */}
              <div className="relative w-full h-full grid grid-cols-3 grid-rows-3 p-1">
                <button
                  type="button"
                  onClick={dsButtons?.onX}
                  className="col-start-2 row-start-1 w-8 h-8 rounded-full bg-(--ugo-button-bg) border border-(--ugo-button-border) shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-px flex items-center justify-center font-bold text-xs text-(--ugo-button-text) cursor-pointer hover:brightness-110 transition-all"
                  aria-label="X"
                >
                  X
                </button>
                <button
                  type="button"
                  onClick={dsButtons?.onY}
                  className="col-start-1 row-start-2 w-8 h-8 rounded-full bg-(--ugo-button-bg) border border-(--ugo-button-border) shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-px flex items-center justify-center font-bold text-xs text-(--ugo-button-text) cursor-pointer hover:brightness-110 transition-all"
                  aria-label="Y"
                >
                  Y
                </button>
                <button
                  type="button"
                  onClick={dsButtons?.onA}
                  className="col-start-3 row-start-2 w-8 h-8 rounded-full bg-(--ugo-button-bg) border border-(--ugo-button-border) shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-px flex items-center justify-center font-bold text-xs text-(--ugo-button-text) cursor-pointer hover:brightness-110 transition-all"
                  aria-label="A"
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={dsButtons?.onB}
                  className="col-start-2 row-start-3 w-8 h-8 rounded-full bg-(--ugo-button-bg) border border-(--ugo-button-border) shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:translate-y-px flex items-center justify-center font-bold text-xs text-(--ugo-button-text) cursor-pointer hover:brightness-110 transition-all"
                  aria-label="B"
                >
                  B
                </button>
              </div>
            </div>

            {/* START/SELECT */}
            <div className="flex flex-col gap-2 pl-1 -mt-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={dsButtons?.onStart}
                  className="w-3.5 h-3.5 rounded-full bg-(--ugo-button-bg) border border-(--ugo-button-border) shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:scale-90 cursor-pointer hover:brightness-110 transition-all"
                  aria-label="START"
                />
                <span className="text-[6px] font-black text-[#bbb] tracking-tighter">
                  START
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={dsButtons?.onSelect}
                  className="w-3.5 h-3.5 rounded-full bg-(--ugo-button-bg) border border-(--ugo-button-border) shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:scale-90 cursor-pointer hover:brightness-110 transition-all"
                  aria-label="SELECT"
                />
                <span className="text-[6px] font-black text-[#bbb] tracking-tighter">
                  SELECT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
