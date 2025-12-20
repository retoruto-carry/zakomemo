"use client";

import type { BrushPatternId } from "@/core/types";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import type { Tool } from "@/engine/WigglyEngine";
import { useState } from "react";
import { eraserVariants, penVariants } from "./variants";

interface WigglyToolsProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
  penVariant: PenVariant;
  setPenVariant: (variant: PenVariant) => void;
  eraserVariant: EraserVariant;
  setEraserVariant: (variant: EraserVariant) => void;
  patternId: BrushPatternId;
  setPatternId: (id: BrushPatternId) => void;

  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  isExporting: boolean;
  exportUrl: string | null;
  exportError: string | null;
}

export function WigglyTools({
  tool,
  setTool,
  color,
  setColor,
  width,
  setWidth,
  penVariant,
  setPenVariant,
  eraserVariant,
  setEraserVariant,
  patternId,
  setPatternId,
  onUndo,
  onRedo,
  onClear,
  onExport,
  isExporting,
  exportUrl,
  exportError,
}: WigglyToolsProps) {
  // Track which popup is open
  const [activePopup, setActivePopup] = useState<"none" | "pattern" | "eraser">("none");

  // Toggle logic
  const handleToolClick = (t: Tool) => {
    // If clicking the already selected tool...
    if (tool === t) {
      // Toggle popup for pattern/eraser, close for others
      if (t === "pattern") {
        setActivePopup(activePopup === "pattern" ? "none" : "pattern");
      } else if (t === "eraser") {
        setActivePopup(activePopup === "eraser" ? "none" : "eraser");
      } else {
        setActivePopup("none");
      }
    } else {
      // Switching to a new tool - close any open popup, don't open new one
      setTool(t);
      setActivePopup("none");
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#fdfbf7] select-none text-(--color-ugo-dark) font-sans p-2 gap-2 relative overflow-hidden">
      {/* Faithful Scanline & Pixel Texture Overlay - Lower Z to stay behind popups */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-15"
        style={{ 
          backgroundImage: `
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `, 
          backgroundSize: "2px 100%, 100% 2px" 
        }}
      />
      
      {/* Background Grid (Faithful Brand Color Orange) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{ 
          backgroundImage: `
            linear-gradient(to right, #ff8c00 1.5px, transparent 1.5px),
            linear-gradient(to bottom, #ff8c00 1.5px, transparent 1.5px)
          `, 
          backgroundSize: "16px 16px" 
        }}
      />

      {/* 1. TOP ROW: Action Buttons (Faithful Orange Beveled Style) */}
      <div className="flex items-center h-16 shrink-0 relative z-10 gap-px">
        {/* Left: Clear All (消す) */}
        <button
          onClick={onClear}
          className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-[#ff9d5c] border-b-[3px] border-r-[3px] border-[#b34700] rounded-[4px] h-full px-4 flex items-center justify-center gap-1.5 active:translate-y-0.5 active:brightness-95 transition-all"
        >
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="absolute w-[4px] h-[4px] bg-white rounded-full" 
                style={{ transform: `rotate(${i * 45}deg) translateY(-8px)` }} 
              />
            ))}
          </div>
          <span className="text-white font-black text-lg leading-none tracking-tighter whitespace-nowrap">消す</span>
        </button>

        {/* Center-Left: Settings */}
        <button className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-[#ff9d5c] border-b-[3px] border-r-[3px] border-[#b34700] rounded-[4px] h-full px-4 flex items-center justify-center gap-1.5 active:translate-y-0.5 group">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white drop-shadow-sm transition-transform group-active:rotate-45">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.21.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
          <span className="text-white font-black text-base leading-none tracking-tighter whitespace-nowrap">設定</span>
        </button>

        {/* Spacer to push Undo/Redo to the right */}
        <div className="flex-1" />

        {/* Right-aligned group: Undo & Redo */}
        <div className="flex gap-px h-full">
          {/* Undo (戻る) */}
          <button
            onClick={onUndo}
            className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-[#ff9d5c] border-b-[3px] border-r-[3px] border-[#b34700] rounded-[4px] h-full px-5 flex items-center justify-center gap-2 active:translate-y-0.5"
          >
            <div className="text-white text-3xl font-black leading-none">⤺</div>
            <span className="text-white font-black text-lg leading-none tracking-tighter whitespace-nowrap">戻る</span>
          </button>

          {/* Redo (進む) */}
          <button
            onClick={onRedo}
            className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-[#ff9d5c] border-b-[3px] border-r-[3px] border-[#b34700] rounded-[4px] h-full px-5 flex items-center justify-center gap-2 active:translate-y-0.5"
          >
            <span className="text-white font-black text-lg leading-none tracking-tighter whitespace-nowrap">進む</span>
            <div className="text-white text-3xl font-black leading-none">⤻</div>
          </button>
        </div>
      </div>

      {/* 2. MIDDLE ROW: Main Tools (Faithful Dot Style) */}
      <div className="flex-1 flex flex-col justify-center min-h-0 relative z-20 py-1">
        <div className="grid grid-cols-3 gap-3 items-center">

          {/* Pen */}
          <button
            onClick={() => handleToolClick("pen")}
            className={`
                  relative flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98] aspect-square w-full rounded-[8px]
                  ${tool === "pen"
                ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-30"
                : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
              }
            `}
          >
            <div className={`absolute top-2.5 left-2.5 text-base font-black ${tool === 'pen' ? 'text-black' : 'text-[#a67c52]'}`}>ペン</div>
            <div className={`text-8xl rotate-45 transform origin-center drop-shadow-sm ${tool === 'pen' ? 'opacity-100' : 'opacity-60'}`}>✏️</div>
            {/* Corner Indicator (Dot Style) */}
            <div className={`absolute bottom-2 right-2 w-11 h-11 border-[4px] rounded-[3px] flex items-center justify-center ${tool === "pen" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}>
              <div className={`w-4.5 h-4.5 ${tool === "pen" ? "bg-black" : "bg-[#d2b48c]"}`} />
            </div>
          </button>

          {/* Paint / Pattern */}
          <button
            onClick={() => {
              setTool("pattern");
              setActivePopup("none");
            }}
            className={`
                  relative flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98] aspect-square w-full rounded-[8px]
                  ${tool === "pattern"
                ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-30"
                : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
              }
            `}
          >
            <div className={`absolute top-2.5 left-2.5 text-base font-black ${tool === 'pattern' ? 'text-black' : 'text-[#a67c52]'}`}>塗る</div>
            <div className={`text-8xl drop-shadow-sm ${tool === 'pattern' ? 'opacity-100' : 'opacity-60'}`}>🖌️</div>
            {/* Corner Indicator */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setTool("pattern");
                setActivePopup(activePopup === "pattern" ? "none" : "pattern");
              }}
              className={`absolute bottom-2 right-2 w-11 h-11 border-[4px] rounded-[3px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 ${tool === "pattern" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}
            >
              <div className="w-6 h-6 shadow-inner"
                style={{
                  backgroundImage:
                    patternId === 'dots' ? "radial-gradient(circle, #000 1.5px, transparent 1.8px)"
                      : patternId === 'dotsDense' ? "radial-gradient(circle, #000 1px, transparent 1.2px)"
                        : patternId === 'horizontal' ? "linear-gradient(0deg, transparent 50%, #000 50%)"
                          : patternId === 'vertical' ? "linear-gradient(90deg, transparent 50%, #000 50%)"
                            : patternId === 'checker' ? "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)"
                              : "radial-gradient(circle, #000 1.5px, transparent 1.8px)",
                  backgroundSize:
                    patternId === 'dots' ? "5px 5px"
                      : patternId === 'dotsDense' ? "3px 3px"
                        : patternId === 'horizontal' ? "100% 3px"
                          : patternId === 'vertical' ? "3px 100%"
                            : patternId === 'checker' ? "5px 5px, 5px 5px, 5px 5px, 5px 5px"
                              : "5px 5px",
                  backgroundPosition: patternId === 'checker' ? "0 0, 0 2.5px, 2.5px -2.5px, -2.5px 0px" : "0 0",
                  opacity: tool === "pattern" ? 0.9 : 0.4,
                  imageRendering: 'pixelated'
                }}
              />
            </div>

            {/* COMPACT POPUP: Pattern Grid (Faithful Dot Style) */}
            {activePopup === "pattern" && (
              <div
                className="absolute bg-white border-[3px] border-black p-1 grid grid-cols-3 gap-1 shadow-[8px_8px_0_rgba(0,0,0,0.2)] z-[100] h-fit rounded-[4px]"
                style={{
                  top: 'calc(100% - 54px)',
                  left: 'calc(100% - 54px)',
                  width: '154px'
                }}
              >
                {[
                  { id: "dots", bg: "radial-gradient(circle, #000 1.5px, transparent 2px)", bgSize: "6px 6px" },
                  { id: "dotsDense", bg: "radial-gradient(circle, #000 1px, transparent 1.5px)", bgSize: "3px 3px" },
                  { id: "vertical", bg: "linear-gradient(90deg, transparent 50%, #000 50%)", bgSize: "4px 100%" },
                  { id: "horizontal", bg: "linear-gradient(0deg, transparent 50%, #000 50%)", bgSize: "100% 4px" },
                  {
                    id: "checker",
                    bg: "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)",
                    bgSize: "6px 6px", bgPos: "0 0, 0 3px, 3px -3px, -3px 0px"
                  },
                ].map((p) => {
                  return (
                    <button
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTool("pattern");
                        setPatternId(p.id as BrushPatternId);
                        setActivePopup("none");
                      }}
                      className={`relative border-[2px] w-11 h-11 overflow-hidden bg-white active:scale-95 transition-all rounded-[2px] ${patternId === p.id
                        ? "border-black bg-[#ffff00]/30"
                        : "border-[#e7d1b1]"
                        }`}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: p.bg,
                          backgroundSize: p.bgSize,
                          backgroundPosition: (p as any).bgPos || "0 0",
                          imageRendering: 'pixelated'
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </button>

          {/* Eraser */}
          <button
            onClick={() => {
              setTool("eraser");
              setActivePopup("none");
            }}
            className={`
                  relative flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98] aspect-square w-full rounded-[8px]
                  ${tool === "eraser"
                ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-30"
                : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
              }
            `}
          >
            <div className={`absolute top-2.5 left-2.5 text-base font-black ${tool === 'eraser' ? 'text-black' : 'text-[#a67c52]'}`}>消しゴム</div>
            <div className={`text-8xl drop-shadow-sm ${tool === 'eraser' ? 'opacity-100' : 'opacity-60'}`}>🩹</div>
            {/* Corner Indicator */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setTool("eraser");
                setActivePopup(activePopup === "eraser" ? "none" : "eraser");
              }}
              className={`absolute bottom-2 right-2 w-11 h-11 border-[4px] rounded-[3px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 ${tool === "eraser" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}
            >
              <div
                className={`${eraserVariant === 'eraserCircle' ? 'rounded-full' :
                  eraserVariant === 'eraserSquare' ? 'rounded-none' :
                    'rounded-none w-6 h-1.5'
                  } ${eraserVariant === 'eraserCircle' || eraserVariant === 'eraserSquare' ? 'w-5 h-5' : ''
                  } ${tool === "eraser" ? "bg-black" : "bg-[#d2b48c]"} shadow-inner`}
              />
            </div>

            {/* COMPACT POPUP: Eraser Grid */}
            {activePopup === "eraser" && (
              <div
                className="absolute bg-white border-[3px] border-black p-1 grid grid-cols-3 gap-1 shadow-[8px_8px_0_rgba(0,0,0,0.2)] z-[100] h-fit rounded-[4px]"
                style={{
                  top: 'calc(100% - 54px)',
                  right: '8px',
                  width: '154px'
                }}
              >
                {eraserVariants.map((v) => {
                  return (
                    <button
                      key={v.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTool("eraser");
                        setEraserVariant(v.id);
                        setActivePopup("none");
                      }}
                      className={`relative border-[2px] w-11 h-11 flex items-center justify-center bg-white active:scale-95 transition-all rounded-[2px]
                                    ${eraserVariant === v.id
                          ? "border-black bg-[#ffff00]/30"
                          : "border-[#e7d1b1]"
                        }`}
                    >
                      <div
                        className={`${v.id === 'eraserCircle' ? 'rounded-full' :
                          v.id === 'eraserSquare' ? 'rounded-none' :
                            'rounded-none w-7 h-2'
                          } ${eraserVariant === v.id ? 'bg-black' : 'bg-[#a67c52]'
                          } ${v.id === 'eraserCircle' || v.id === 'eraserSquare' ? 'w-6 h-6' : ''
                          }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* 3. BOTTOM ROW: Slider | Colors | Save */}
      <div className="h-16 shrink-0 flex items-center gap-2 relative z-10">
        {/* Slider */}
        <div className="w-[28%] h-full bg-[#fffdeb] border-[3px] border-[#d2b48c] p-2 flex flex-col justify-center relative overflow-hidden shadow-[3px_3px_0_rgba(210,180,140,0.2)] rounded-[4px]">
          <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 h-6 bg-[#fdfdfd]" style={{ clipPath: "polygon(0 80%, 100% 20%, 100% 100%, 0% 100%)" }} />
          <input
            type="range"
            min={1}
            max={24}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-full h-8 relative z-10 accent-[#ff6b00] cursor-pointer mix-blend-multiply"
          />
        </div>

        {/* Colors */}
        <div className="flex-1 h-full bg-[#fffdeb] border-[3px] border-[#d2b48c] p-1 flex items-center justify-center gap-1.5 shadow-[3px_3px_0_rgba(210,180,140,0.2)] rounded-[4px]">
          {["#0b0b0b", "#ff3b30", "#34c759", "#007aff", "#fbbf24", "#9b51e0"].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`
                            h-9 w-9 rounded-[2px] transition-transform shadow-sm shrink-0 relative
                            ${color === c 
                              ? "border-black border-[3px] scale-110 z-10 shadow-[0_0_0_2px_rgba(255,255,255,0.8)]" 
                              : "border-white border-[2px] hover:scale-105"
                            }
                        `}
            >
              {color === c && (
                <div className="absolute inset-0 border-2 border-white opacity-80 pointer-events-none" />
              )}
            </button>
          ))}
        </div>

        {/* Save Button (Faithful Orange Style) */}
        <div className="h-full">
          {exportUrl ? (
            <a
              href={exportUrl}
              download="wiggly-ugomemo.gif"
              className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-[#ff9d5c] border-b-[3px] border-r-[3px] border-[#b34700] rounded-[3px] h-full px-5 flex items-center justify-center active:translate-y-0.5 transition-all text-white font-black text-xl"
            >
              保存
            </a>
          ) : (
            <button
              onClick={onExport}
              disabled={isExporting}
              className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-[#ff9d5c] border-b-[3px] border-r-[3px] border-[#b34700] rounded-[3px] h-full px-5 flex items-center justify-center active:translate-y-0.5 transition-all text-white font-black text-xl disabled:opacity-50"
            >
              {isExporting ? "..." : "保存"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
