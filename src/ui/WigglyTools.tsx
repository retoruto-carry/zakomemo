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
      if (t === "pattern") {
        setActivePopup(activePopup === "pattern" ? "none" : "pattern");
      } else if (t === "eraser") {
        setActivePopup(activePopup === "eraser" ? "none" : "eraser");
      } else {
        setActivePopup("none");
      }
    } else {
      // Switching to a new tool
      setTool(t);
      if (t === "pattern") setActivePopup("pattern");
      else if (t === "eraser") setActivePopup("eraser");
      else setActivePopup("none");
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f0f0eb] select-none text-[color:var(--color-ugo-dark)] font-sans p-2 gap-2 relative overflow-hidden">

      {/* 1. TOP ROW: Clear | Settings | Undo/Redo */}
      <div className="flex items-center gap-2 h-14 shrink-0">
        {/* Left: Clear All */}
        <button
          onClick={onClear}
          className="h-full px-4 bg-white border-2 border-slate-400 rounded-lg flex flex-col items-center justify-center shadow-sm active:translate-y-1 active:shadow-none"
        >
          <span className="text-xs font-bold leading-tight">全消し</span>
          <span className="text-xl leading-none text-rose-500">💥</span>
        </button>

        {/* Center: Settings (Placeholder matching wireframe) */}
        <button className="h-full aspect-square bg-white border-2 border-slate-400 rounded-lg flex items-center justify-center shadow-sm active:translate-y-1 active:shadow-none ml-auto mr-auto">
          <span className="text-2xl text-slate-400">⚙️</span>
          <span className="sr-only">設定</span>
        </button>

        {/* Right: Undo / Redo Group */}
        <div className="flex bg-white border-2 border-slate-400 rounded-lg h-full p-1 gap-1 shadow-sm items-center relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 bg-[#f0f0eb] px-1 whitespace-nowrap">やり直し</span>
          <button onClick={onUndo} className="h-full w-10 flex items-center justify-center text-2xl font-bold bg-slate-100 rounded hover:bg-slate-200 active:bg-slate-200">
            ⤺
          </button>
          <div className="w-px h-6 bg-slate-300" />
          <button onClick={onRedo} className="h-full w-10 flex items-center justify-center text-2xl font-bold bg-slate-100 rounded hover:bg-slate-200 active:bg-slate-200">
            ⤻
          </button>
        </div>
      </div>

      {/* 2. MIDDLE ROW: Main Tools (Big Squares) */}
      <div className="flex-1 grid grid-cols-3 gap-2 min-h-0 relative z-10">

        {/* Pen */}
        <button
          onClick={() => handleToolClick("pen")}
          className={`
                relative border-4 rounded-xl flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98]
                ${tool === "pen"
              ? "bg-white border-[color:var(--color-ugo-orange)] shadow-[0_0_0_2px_var(--color-ugo-orange)] z-10"
              : "bg-white border-slate-300 text-slate-400"
            }
            `}
        >
          <div className="absolute top-2 left-2 text-xs font-bold opacity-50">ペン</div>
          <div className="text-6xl rotate-45 transform origin-center drop-shadow-sm">✏️</div>
          {/* Corner Indicator */}
          <div className={`absolute bottom-2 right-2 w-8 h-8 border-2 rounded-lg flex items-center justify-center transition-colors ${tool === "pen" ? "border-orange-500 bg-orange-100" : "border-slate-300 bg-slate-100"}`}>
            <div className={`w-3 h-3 rounded-sm ${tool === "pen" ? "bg-orange-500" : "bg-slate-300"}`} />
          </div>
        </button>

        {/* Paint / Pattern */}
        <button
          onClick={() => handleToolClick("pattern")}
          className={`
                relative border-4 rounded-xl flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98]
                ${tool === "pattern"
              ? "bg-amber-50 border-[color:var(--color-ugo-orange)] shadow-[0_0_0_2px_var(--color-ugo-orange)] z-10"
              : "bg-white border-slate-300 text-slate-400"
            }
            `}
        >
          <div className="absolute top-2 left-2 text-xs font-bold opacity-50">塗る</div>
          <div className="text-6xl drop-shadow-sm">🖌️</div>
          {/* Corner Indicator */}
          <div className={`absolute bottom-2 right-2 w-8 h-8 border-2 rounded-lg flex items-center justify-center transition-colors ${tool === "pattern" ? "border-orange-500 bg-orange-100" : "border-slate-300 bg-slate-100"}`}>
            {/* Tiny preview of current pattern */}
            <div className="w-4 h-4 opacity-50 rounded-sm"
              style={{
                backgroundImage: patternId === 'dots' ? "radial-gradient(circle, #000 2px, transparent 2.5px)"
                  : patternId === 'horizontal' ? "linear-gradient(0deg, transparent 50%, #000 50%)"
                    : "radial-gradient(circle, #000 1.5px, transparent 2px)", // default or current logical match
                backgroundSize: "4px 4px"
              }}
            />
          </div>

          {/* COMPACT POPUP: Pattern Grid */}
          {activePopup === "pattern" && (
            <div className="absolute top-full mt-2 w-48 bg-white rounded-xl border-4 border-orange-500 p-2 grid grid-cols-2 gap-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 left-1/2 -translate-x-1/2">
              {[
                { id: "dots", label: "小", bg: "radial-gradient(circle, #000 2px, transparent 2.5px)", bgSize: "8px 8px" },
                { id: "dotsDense", label: "中", bg: "radial-gradient(circle, #000 1.5px, transparent 2px)", bgSize: "4px 4px" },
                { id: "horizontal", label: "横", bg: "linear-gradient(0deg, transparent 50%, #000 50%)", bgSize: "100% 4px" },
                { id: "vertical", label: "縦", bg: "linear-gradient(90deg, transparent 50%, #000 50%)", bgSize: "4px 100%" },
                {
                  id: "checker", label: "市松",
                  bg: "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)",
                  bgSize: "8px 8px", bgPos: "0 0, 0 4px, 4px -4px, -4px 0px"
                },
              ].map((p, i) => (
                <button
                  key={p.id || i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPatternId(p.id as BrushPatternId);
                    setActivePopup("none");
                  }}
                  className={`relative rounded border-2 h-12 overflow-hidden bg-white hover:bg-slate-50 active:scale-95 transition-all aspect-square ${patternId === p.id ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-200"}`}
                  title={p.label}
                >
                  <div className="absolute inset-0 opacity-50" style={{ backgroundImage: p.bg, backgroundSize: p.bgSize, backgroundPosition: (p as any).bgPos }} />
                </button>
              ))}
            </div>
          )}
        </button>

        {/* Eraser */}
        <button
          onClick={() => handleToolClick("eraser")}
          className={`
                relative border-4 rounded-xl flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98]
                ${tool === "eraser"
              ? "bg-white border-[color:var(--color-ugo-orange)] shadow-[0_0_0_2px_var(--color-ugo-orange)] z-10"
              : "bg-white border-slate-300 text-slate-400"
            }
            `}
        >
          <div className="absolute top-2 left-2 text-xs font-bold opacity-50">消しゴム</div>
          <div className="text-6xl drop-shadow-sm">🩹</div>
          {/* Corner Indicator */}
          <div className={`absolute bottom-2 right-2 w-8 h-8 border-2 rounded-lg flex items-center justify-center transition-colors ${tool === "eraser" ? "border-orange-500 bg-orange-100" : "border-slate-300 bg-slate-100"}`}>
            <div className={`w-3 h-3 rounded-sm ${tool === "eraser" ? "bg-orange-500" : "bg-slate-300"}`} />
          </div>

          {/* COMPACT POPUP: Eraser Grid */}
          {activePopup === "eraser" && (
            <div className="absolute top-full mt-2 w-48 bg-white rounded-xl border-4 border-orange-500 p-2 grid grid-cols-1 gap-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 right-0">
              {eraserVariants.map((v) => (
                <button
                  key={v.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEraserVariant(v.id);
                    setActivePopup("none");
                  }}
                  className={`relative rounded border-2 h-10 px-2 flex items-center gap-2 bg-white hover:bg-slate-50 active:scale-95 transition-all
                                ${eraserVariant === v.id ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-200"}`}
                >
                  {/* Icon for size/type */}
                  <div className={`rounded-full bg-slate-300 ${v.id === 'standard' ? 'w-4 h-4' : v.id === 'soft' ? 'w-4 h-4 opacity-50 blur-[1px]' : 'w-6 h-6'}`} />
                  <span className="text-sm font-bold text-slate-700">{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </button>
      </div>

      {/* 3. BOTTOM ROW: Slider | Colors | Save */}
      <div className="h-16 shrink-0 flex items-center gap-2">

        {/* Slider */}
        <div className="w-1/3 h-full bg-white border-2 border-slate-400 rounded-lg p-2 flex flex-col justify-center relative overflow-hidden">
          {/* Visual Wedge Shape Background */}
          <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 h-6 bg-slate-100" style={{ clipPath: "polygon(0 80%, 100% 20%, 100% 100%, 0% 100%)" }} />
          <input
            type="range"
            min={1}
            max={24}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-full h-8 relative z-10 accent-slate-800 opacity-80 cursor-pointer mix-blend-multiply"
          />
        </div>

        {/* Colors */}
        <div className="flex-1 h-full bg-white border-2 border-slate-400 rounded-lg p-1 flex items-center justify-around">
          {["#0b0b0b", "#ff3b30", "#34c759", "#007aff", "#fbbf24", "#9b51e0"].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`
                            h-8 w-8 rounded-full border-2 transition-transform shadow-sm
                            ${color === c ? "border-black scale-110 ring-2 ring-white/50" : "border-transparent hover:scale-105"}
                        `}
            />
          ))}
        </div>

        {/* Save Button */}
        <div className="h-full">
          {exportUrl ? (
            <a
              href={exportUrl}
              download="wiggly-ugomemo.gif"
              className="h-full px-4 rounded-lg border-4 border-orange-500 bg-orange-100 text-orange-600 font-bold text-lg flex items-center justify-center shadow-sm active:translate-y-1"
            >
              保存
            </a>
          ) : (
            <button
              onClick={onExport}
              disabled={isExporting}
              className="h-full px-4 rounded-lg border-2 border-slate-400 bg-white text-slate-800 font-bold text-lg flex items-center justify-center shadow-sm active:translate-y-1 disabled:opacity-50"
            >
              {isExporting ? "..." : "保存"}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
