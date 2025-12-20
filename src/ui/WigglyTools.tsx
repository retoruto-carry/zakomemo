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
    <div className="flex flex-col w-full bg-[#f0f0eb] select-none text-[color:var(--color-ugo-dark)] font-sans p-2 gap-2 relative">

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
      <div className="flex-1 flex flex-col justify-center min-h-0 relative z-10 py-2">
        <div className="grid grid-cols-3 gap-2 items-center">

          {/* Pen */}
          <button
            onClick={() => handleToolClick("pen")}
            className={`
                relative border-4 rounded-xl flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98] aspect-square w-full
                ${tool === "pen"
                ? "bg-white border-[color:var(--color-ugo-orange)] shadow-[0_0_0_2px_var(--color-ugo-orange)] z-10"
                : "bg-white border-slate-300 text-slate-400"
              }
            `}
          >
            <div className="absolute top-2 left-2 text-lg font-black opacity-60">ペン</div>
            <div className="text-6xl rotate-45 transform origin-center drop-shadow-sm">✏️</div>
            {/* Corner Indicator */}
            <div className={`absolute bottom-2 right-2 w-8 h-8 border-2 rounded-lg flex items-center justify-center transition-colors ${tool === "pen" ? "border-orange-500 bg-orange-100" : "border-slate-300 bg-slate-100"}`}>
              <div className={`w-3 h-3 rounded-sm ${tool === "pen" ? "bg-orange-500" : "bg-slate-300"}`} />
            </div>
          </button>

          {/* Paint / Pattern */}
          <button
            onClick={() => {
              // Main button click: just select the tool without opening popup
              setTool("pattern");
              setActivePopup("none");
            }}
            className={`
                relative border-4 rounded-xl flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98] aspect-square w-full
                ${tool === "pattern"
                ? "bg-amber-50 border-[color:var(--color-ugo-orange)] shadow-[0_0_0_2px_var(--color-ugo-orange)] z-10"
                : "bg-white border-slate-300 text-slate-400"
              }
            `}
          >
            <div className="absolute top-2 left-2 text-lg font-black opacity-60">塗る</div>
            <div className="text-6xl drop-shadow-sm">🖌️</div>
            {/* Corner Indicator - Clicking this opens the popup immediately */}
            <div
              onClick={(e) => {
                e.stopPropagation(); // Prevent main button's onClick
                setTool("pattern"); // Also select the tool
                setActivePopup(activePopup === "pattern" ? "none" : "pattern");
              }}
              className={`absolute bottom-2 right-2 w-10 h-10 border-2 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-90 z-20 ${tool === "pattern" ? "border-orange-500 bg-orange-100" : "border-slate-300 bg-slate-100"}`}
            >
              {/* Tiny preview of current pattern */}
              <div className="w-6 h-6 rounded-sm"
                style={{
                  backgroundImage:
                    patternId === 'dots' ? "radial-gradient(circle, #000 1px, transparent 1.5px)"
                      : patternId === 'dotsDense' ? "radial-gradient(circle, #000 0.8px, transparent 1px)"
                        : patternId === 'horizontal' ? "linear-gradient(0deg, transparent 50%, #000 50%)"
                          : patternId === 'vertical' ? "linear-gradient(90deg, transparent 50%, #000 50%)"
                            : patternId === 'checker' ? "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)"
                              : "radial-gradient(circle, #000 1px, transparent 1.5px)",
                  backgroundSize:
                    patternId === 'dots' ? "3px 3px"
                      : patternId === 'dotsDense' ? "2px 2px"
                        : patternId === 'horizontal' ? "100% 2px"
                          : patternId === 'vertical' ? "2px 100%"
                            : patternId === 'checker' ? "3px 3px, 3px 3px, 3px 3px, 3px 3px"
                              : "3px 3px",
                  backgroundPosition: patternId === 'checker' ? "0 0, 0 1.5px, 1.5px -1.5px, -1.5px 0px" : "0 0",
                  opacity: tool === "pattern" ? 0.8 : 0.5
                }}
              />
            </div>

            {/* COMPACT POPUP: Pattern Grid (3x3) */}
            {activePopup === "pattern" && (
              <div
                className="absolute bg-white rounded-lg border-2 border-orange-500 p-1 grid grid-cols-3 gap-1 shadow-xl z-50 h-fit"
                style={{
                  top: 'calc(100% - 48px)',
                  left: 'calc(100% - 48px)',
                  width: '134px'
                }}
              >
                {[
                  { id: "dots", bg: "radial-gradient(circle, #000 1.5px, transparent 2px)", bgSize: "6px 6px" },
                  { id: "dotsDense", bg: "radial-gradient(circle, #000 1px, transparent 1.5px)", bgSize: "3px 3px" },
                  { id: "vertical", bg: "linear-gradient(90deg, transparent 50%, #000 50%)", bgSize: "3px 100%" },
                  { id: "horizontal", bg: "linear-gradient(0deg, transparent 50%, #000 50%)", bgSize: "100% 3px" },
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
                        setTool("pattern"); // Select tool when pattern chosen
                        setPatternId(p.id as BrushPatternId);
                        setActivePopup("none");
                      }}
                      className={`relative rounded border-2 w-10 h-10 overflow-hidden bg-white hover:bg-orange-50 active:scale-95 transition-all ${patternId === p.id
                        ? "border-orange-500 bg-orange-100 ring-2 ring-orange-300 shadow-md"
                        : "border-slate-300 hover:border-orange-300"
                        }`}
                      title={p.id}
                    >
                      <div
                        className={`absolute inset-0 ${patternId === p.id ? "opacity-100" : "opacity-70"}`}
                        style={{
                          backgroundImage: p.bg,
                          backgroundSize: p.bgSize,
                          backgroundPosition: (p as any).bgPos || "0 0"
                        }}
                      />
                      {patternId === p.id && (
                        <div className="absolute inset-0 border-2 border-orange-600 rounded pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </button>

          {/* Eraser */}
          <button
            onClick={() => {
              // Main button click: just select the tool without opening popup
              setTool("eraser");
              setActivePopup("none");
            }}
            className={`
                relative border-4 rounded-xl flex flex-col items-center justify-center p-2 transition-all active:scale-[0.98] aspect-square w-full
                ${tool === "eraser"
                ? "bg-white border-[color:var(--color-ugo-orange)] shadow-[0_0_0_2px_var(--color-ugo-orange)] z-10"
                : "bg-white border-slate-300 text-slate-400"
              }
            `}
          >
            <div className="absolute top-2 left-2 text-lg font-black opacity-60">消しゴム</div>
            <div className="text-6xl drop-shadow-sm">🩹</div>
            {/* Corner Indicator - Clicking this opens the popup immediately */}
            <div
              onClick={(e) => {
                e.stopPropagation(); // Prevent main button's onClick
                setTool("eraser"); // Also select the tool
                setActivePopup(activePopup === "eraser" ? "none" : "eraser");
              }}
              className={`absolute bottom-2 right-2 w-10 h-10 border-2 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-90 z-20 ${tool === "eraser" ? "border-orange-500 bg-orange-100" : "border-slate-300 bg-slate-100"}`}
            >
              <div
                className={`${eraserVariant === 'eraserCircle' ? 'rounded-full' :
                  eraserVariant === 'eraserSquare' ? 'rounded-sm' :
                    'rounded-none w-4 h-1'
                  } ${eraserVariant === 'eraserCircle' || eraserVariant === 'eraserSquare' ? 'w-4 h-4' : ''
                  } ${tool === "eraser" ? "bg-orange-600" : "bg-slate-400"}`}
              />
            </div>

            {/* COMPACT POPUP: Eraser Grid (3x3, same size as pattern) */}
            {activePopup === "eraser" && (
              <div
                className="absolute bg-white rounded-lg border-2 border-orange-500 p-1 grid grid-cols-3 gap-1 shadow-xl z-50 h-fit"
                style={{
                  top: 'calc(100% - 48px)',
                  right: '8px',
                  width: '134px'
                }}
              >
                {eraserVariants.map((v) => {
                  return (
                    <button
                      key={v.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTool("eraser"); // Select tool when variant chosen
                        setEraserVariant(v.id);
                        setActivePopup("none");
                      }}
                      className={`relative rounded border-2 w-10 h-10 flex items-center justify-center bg-white hover:bg-orange-50 active:scale-95 transition-all
                                  ${eraserVariant === v.id
                          ? "border-orange-500 bg-orange-100 ring-2 ring-orange-300 shadow-md"
                          : "border-slate-300 hover:border-orange-300"
                        }`}
                    >
                      {/* Icon for eraser type */}
                      <div
                        className={`${v.id === 'eraserCircle' ? 'rounded-full' :
                          v.id === 'eraserSquare' ? 'rounded-sm' :
                            'rounded-none w-6 h-1'
                          } ${eraserVariant === v.id ? 'bg-orange-700' : 'bg-slate-600'
                          } ${v.id === 'eraserCircle' || v.id === 'eraserSquare' ? 'w-6 h-6' : ''
                          }`}
                      />
                      {eraserVariant === v.id && (
                        <div className="absolute inset-0 border-2 border-orange-600 rounded pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </button>
        </div>
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
