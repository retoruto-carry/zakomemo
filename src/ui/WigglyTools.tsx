"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import type { BrushPatternId } from "@/core/types";
import type { EraserVariant } from "@/engine/variants";
import type { Tool } from "@/engine/WigglyEngine";
import { isMobile } from "@/lib/share";
import { AnimatedGif, type AnimatedGifHandle } from "./components/AnimatedGif";
import { ShareButton } from "./components/ShareButton";
import {
  BODY_PRESETS,
  type BodyColor,
  generateBodyColorFromBase,
  PALETTE_PRESETS,
} from "./presets";
import { eraserVariants } from "./variants";

// キーボードアクセシビリティ: Enter/Space で onClick を発火
const handleButtonKeyDown = (callback: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    callback();
  }
};

/** ペン幅スライダーの最小値 */
const MIN_PEN_WIDTH = 1;
/** ペン幅スライダーの最大値 */
const MAX_PEN_WIDTH = 48;

// パターンプレビュー用スタイル設定（実際の描画と同じ2倍スケール）
const PATTERN_STYLES: Record<
  BrushPatternId,
  { image: string; size: string; position: string }
> = {
  dots: {
    image: "radial-gradient(circle, #000 3px, transparent 3.6px)",
    size: "10px 10px",
    position: "0 0",
  },
  dotsDense: {
    image: "radial-gradient(circle, #000 2px, transparent 2.4px)",
    size: "6px 6px",
    position: "0 0",
  },
  horizontal: {
    image: "linear-gradient(0deg, transparent 50%, #000 50%)",
    size: "100% 6px",
    position: "0 0",
  },
  vertical: {
    image: "linear-gradient(90deg, transparent 50%, #000 50%)",
    size: "6px 100%",
    position: "0 0",
  },
  checker: {
    image:
      "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)",
    size: "10px 10px, 10px 10px, 10px 10px, 10px 10px",
    position: "0 0, 0 5px, 5px -5px, -5px 0px",
  },
};

interface WigglyToolsProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
  eraserVariant: EraserVariant;
  setEraserVariant: (variant: EraserVariant) => void;
  patternId: BrushPatternId;
  setPatternId: (id: BrushPatternId) => void;

  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onClear: () => void;
  onExport: () => void;
  isExporting: boolean;
  exportUrl: string | null;
  exportError: string | null;
  onCloseExport: () => void;

  palette: string[];
  setPalette: (palette: string[]) => void;
  bodyColor: BodyColor;
  setBodyColor: (bodyColor: BodyColor) => void;
}

export function WigglyTools({
  tool,
  setTool,
  color,
  setColor,
  width,
  setWidth,
  eraserVariant,
  setEraserVariant,
  patternId,
  setPatternId,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onExport,
  isExporting,
  exportUrl,
  exportError,
  onCloseExport,
  palette,
  setPalette,
  bodyColor,
  setBodyColor,
}: WigglyToolsProps) {
  // Track which popup is open
  const [activePopup, setActivePopup] = useState<
    "none" | "pattern" | "eraser" | "settings"
  >("none");
  const [settingsTab, setSettingsTab] = useState<"palette" | "body">("palette");
  const undoGifRef = useRef<AnimatedGifHandle>(null);

  const handleUndo = () => {
    undoGifRef.current?.playAnimation();
    onUndo();
  };

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
    <div className="flex flex-col w-full h-full bg-[#fdfbf7] select-none text-(--color-ugo-dark) font-sans p-3 gap-2.5 relative overflow-hidden">
      {/* Faithful Scanline & Pixel Texture Overlay - Lower Z to stay behind popups */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-15"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "2px 100%, 100% 2px",
        }}
      />

      {/* Background Grid (Faithful Brand Color Orange) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ff8c00 1.5px, transparent 1.5px),
            linear-gradient(to bottom, #ff8c00 1.5px, transparent 1.5px)
          `,
          backgroundSize: "16px 16px",
        }}
      />

      {/* 1. TOP ROW: Action Buttons (Faithful Orange Beveled Style) */}
      <div className="flex items-center h-14 shrink-0 relative z-10 gap-2">
        {/* Left: Clear All (消す) */}
        {/* biome-ignore lint/a11y/useSemanticElements: Custom styled button */}
        <div
          onClick={onClear}
          onKeyDown={handleButtonKeyDown(onClear)}
          role="button"
          tabIndex={0}
          className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-t-[#ff9d5c] border-l-[#ff9d5c] border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-[6px] h-full px-3 flex items-center justify-center gap-1.5 active:translate-y-0.5 active:brightness-95 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00]"
        >
          <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((angle) => (
              <div
                key={`sparkle-${angle}`}
                className="absolute w-[3px] h-[3px] bg-white rounded-full"
                style={{
                  transform: `rotate(${angle * 45}deg) translateY(-7px)`,
                }}
              />
            ))}
          </div>
          <span className="text-white font-black text-base leading-none tracking-tighter whitespace-nowrap">
            消す
          </span>
        </div>

        {/* Center-Left: Settings */}
        {/* biome-ignore lint/a11y/useSemanticElements: Custom styled button */}
        <div
          onClick={() => setActivePopup("settings")}
          onKeyDown={handleButtonKeyDown(() => setActivePopup("settings"))}
          role="button"
          tabIndex={0}
          className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-t-[#ff9d5c] border-l-[#ff9d5c] border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-[6px] h-full px-3 flex items-center justify-center gap-1.5 active:translate-y-0.5 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="w-6 h-6 text-white drop-shadow-sm transition-transform group-active:rotate-45"
          >
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.21.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
          <span className="text-white font-black text-sm leading-none tracking-tighter whitespace-nowrap">
            設定
          </span>
        </div>

        {/* Spacer to push Undo/Redo to the right */}
        <div className="flex-1" />

        {/* Right-aligned group: Undo & Redo */}
        <div className="flex h-full items-stretch">
          {/* Undo (やり直し) */}
          {/* biome-ignore lint/a11y/useSemanticElements: Custom styled button */}
          <div
            onClick={canUndo ? handleUndo : undefined}
            onKeyDown={canUndo ? handleButtonKeyDown(handleUndo) : undefined}
            role="button"
            tabIndex={canUndo ? 0 : -1}
            aria-disabled={!canUndo}
            className={`
              border-t-[3px] border-l-[3px] border-b-[3px] border-r-[1.5px] 
              rounded-l-[6px] h-full px-4 flex items-center justify-center gap-1.5 
              transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00]
              ${
                !canUndo
                  ? "bg-[#ffd6b8] border-t-white border-l-[#fffefc] border-b-[#ffb38a] border-r-[#ffb38a] pointer-events-none"
                  : "bg-[#ff6b00] border-[#ff9d5c] border-b-[#b34700] border-r-[#b34700] active:translate-y-0.5 active:brightness-95"
              }
            `}
          >
            <AnimatedGif
              ref={undoGifRef}
              staticSrc="/images/frog2.png"
              animatedSrc="/images/frog2_1loop.gif"
              alt=""
              className={`w-9 h-9 ${!canUndo ? "opacity-50" : ""}`}
            />
            <span className="text-white font-black text-lg leading-none tracking-tighter whitespace-nowrap">
              やり直し
            </span>
          </div>

          {/* Redo (進む) */}
          {/* biome-ignore lint/a11y/useSemanticElements: Custom styled button */}
          <div
            onClick={onRedo}
            onKeyDown={handleButtonKeyDown(onRedo)}
            role="button"
            tabIndex={canRedo ? 0 : -1}
            aria-disabled={!canRedo}
            className={`
              border-t-[3px] border-l-[1.5px] border-r-[3px] border-b-[3px] 
              rounded-r-[6px] h-full px-3 flex items-center justify-center 
              transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00]
              ${
                !canRedo
                  ? "bg-[#ffd6b8] border-t-white border-l-[#ffb38a] border-r-[#ffb38a] border-b-[#ffb38a] pointer-events-none"
                  : "bg-[#ff6b00] border-t-[#ff9d5c] border-l-[#ff9d5c] border-r-[#b34700] border-b-[#b34700] active:translate-y-0.5 active:brightness-95"
              }
            `}
          >
            <div className="text-white text-2xl font-black leading-none">⤻</div>
          </div>
        </div>
      </div>

      {/* 2. MIDDLE ROW: Main Tools (Faithful Dot Style) */}
      <div className="flex-1 flex flex-col justify-center min-h-0 relative z-20 py-1">
        <div className="grid grid-cols-3 gap-2.5 items-center">
          {/* Pen */}
          {/* biome-ignore lint/a11y/useSemanticElements: Custom styled button with nested indicator */}
          <div
            onClick={() => handleToolClick("pen")}
            onKeyDown={handleButtonKeyDown(() => handleToolClick("pen"))}
            role="button"
            tabIndex={0}
            className={`
                  relative flex flex-col items-center justify-center p-1.5 transition-all active:scale-[0.98] aspect-square w-full rounded-[8px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                  ${
                    tool === "pen"
                      ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-30"
                      : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
                  }
            `}
          >
            <div
              className={`absolute top-2 left-2 text-sm font-black ${tool === "pen" ? "text-black" : "text-[#a67c52]"}`}
            >
              ペン
            </div>
            {/* biome-ignore lint/performance/noImgElement: ツールアイコン表示のため */}
            <img
              src={
                tool === "pen" ? "/images/pen_on.png" : "/images/pen_off.png"
              }
              alt="ペン"
              className="w-20 h-20 object-contain drop-shadow-sm"
              aria-hidden="true"
            />
            {/* Corner Indicator (Circle) */}
            <div
              className={`absolute bottom-1.5 right-1.5 w-9 h-9 border-[3px] rounded-[3px] flex items-center justify-center ${tool === "pen" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}
            >
              <div
                className={`w-4 h-4 rounded-full ${tool === "pen" ? "bg-black" : "bg-[#d2b48c]"}`}
              />
            </div>
          </div>

          {/* Paint / Pattern */}
          {/* biome-ignore lint/a11y/useSemanticElements: Custom styled button with nested indicator */}
          <div
            onClick={() => {
              setTool("pattern");
              setActivePopup("none");
            }}
            onKeyDown={handleButtonKeyDown(() => {
              setTool("pattern");
              setActivePopup("none");
            })}
            role="button"
            tabIndex={0}
            className={`
                  relative flex flex-col items-center justify-center p-1.5 transition-all active:scale-[0.98] aspect-square w-full rounded-[8px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                  ${
                    tool === "pattern"
                      ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-30"
                      : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
                  }
            `}
          >
            <div
              className={`absolute top-2 left-2 text-sm font-black ${tool === "pattern" ? "text-black" : "text-[#a67c52]"}`}
            >
              塗る
            </div>
            {/* biome-ignore lint/performance/noImgElement: ツールアイコン表示のため */}
            <img
              src={
                tool === "pattern"
                  ? "/images/pattern_on.png"
                  : "/images/pattern_off.png"
              }
              alt="塗る"
              className="w-20 h-20 object-contain drop-shadow-sm"
              aria-hidden="true"
            />
            {/* Corner Indicator */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTool("pattern");
                setActivePopup(activePopup === "pattern" ? "none" : "pattern");
              }}
              className={`absolute bottom-1.5 right-1.5 w-9 h-9 border-[3px] rounded-[3px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-black ${tool === "pattern" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}
            >
              <div
                className="w-6 h-6 shadow-inner"
                style={{
                  backgroundImage:
                    PATTERN_STYLES[patternId]?.image ??
                    PATTERN_STYLES.dots.image,
                  backgroundSize:
                    PATTERN_STYLES[patternId]?.size ?? PATTERN_STYLES.dots.size,
                  backgroundPosition:
                    PATTERN_STYLES[patternId]?.position ??
                    PATTERN_STYLES.dots.position,
                  opacity: tool === "pattern" ? 0.9 : 0.4,
                  imageRendering: "pixelated",
                }}
              />
            </button>

            {/* COMPACT POPUP: Pattern Grid (Faithful Dot Style) */}
            {activePopup === "pattern" && (
              <div
                className="absolute bg-white border-[3px] border-black p-0.5 grid grid-cols-3 gap-0.5 shadow-[8px_8px_0_rgba(0,0,0,0.2)] z-[100] h-fit rounded-[4px]"
                style={{
                  top: "calc(100% - 54px)",
                  left: "calc(100% - 54px)",
                  width: "140px",
                }}
              >
                {(
                  [
                    {
                      id: "dots",
                      bg: "radial-gradient(circle, #000 3px, transparent 4px)",
                      bgSize: "12px 12px",
                    },
                    {
                      id: "dotsDense",
                      bg: "radial-gradient(circle, #000 2px, transparent 3px)",
                      bgSize: "6px 6px",
                    },
                    {
                      id: "vertical",
                      bg: "linear-gradient(90deg, transparent 50%, #000 50%)",
                      bgSize: "8px 100%",
                    },
                    {
                      id: "horizontal",
                      bg: "linear-gradient(0deg, transparent 50%, #000 50%)",
                      bgSize: "100% 8px",
                    },
                    {
                      id: "checker",
                      bg: "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)",
                      bgSize: "12px 12px",
                      bgPos: "0 0, 0 6px, 6px -6px, -6px 0px",
                    },
                  ] as {
                    id: string;
                    bg: string;
                    bgSize: string;
                    bgPos?: string;
                  }[]
                ).map((p) => {
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTool("pattern");
                        setPatternId(p.id as BrushPatternId);
                        setActivePopup("none");
                      }}
                      className={`relative border-[2px] w-9 h-9 overflow-hidden bg-white active:scale-95 transition-all rounded-[2px] ${
                        patternId === p.id
                          ? "border-black bg-[#ffff00]/30"
                          : "border-[#e7d1b1]"
                      }`}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: p.bg,
                          backgroundSize: p.bgSize,
                          backgroundPosition: p.bgPos ?? "0 0",
                          imageRendering: "pixelated",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Eraser */}
          {/* biome-ignore lint/a11y/useSemanticElements: Custom styled button with nested indicator */}
          <div
            onClick={() => {
              setTool("eraser");
              setActivePopup("none");
            }}
            onKeyDown={handleButtonKeyDown(() => {
              setTool("eraser");
              setActivePopup("none");
            })}
            role="button"
            tabIndex={0}
            className={`
                  relative flex flex-col items-center justify-center p-1.5 transition-all active:scale-[0.98] aspect-square w-full rounded-[8px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                  ${
                    tool === "eraser"
                      ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-30"
                      : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
                  }
            `}
          >
            <div
              className={`absolute top-2 left-2 text-sm font-black ${tool === "eraser" ? "text-black" : "text-[#a67c52]"}`}
            >
              消しゴム
            </div>
            {/* biome-ignore lint/performance/noImgElement: ツールアイコン表示のため */}
            <img
              src={
                tool === "eraser"
                  ? "/images/eraser_on.png"
                  : "/images/eraser_off.png"
              }
              alt="消しゴム"
              className="w-20 h-20 object-contain drop-shadow-sm"
              aria-hidden="true"
            />
            {/* Corner Indicator */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTool("eraser");
                setActivePopup(activePopup === "eraser" ? "none" : "eraser");
              }}
              className={`absolute bottom-1.5 right-1.5 w-9 h-9 border-[3px] rounded-[3px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-black ${tool === "eraser" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}
            >
              <div
                className={`${
                  eraserVariant === "eraserCircle"
                    ? "rounded-full"
                    : eraserVariant === "eraserSquare"
                      ? "rounded-none"
                      : "rounded-none w-6 h-1.5"
                } ${
                  eraserVariant === "eraserCircle" ||
                  eraserVariant === "eraserSquare"
                    ? "w-5 h-5"
                    : ""
                } bg-white border-[1.5px] ${tool === "eraser" ? "border-black" : "border-[#d2b48c]"} shadow-inner`}
              />
            </button>

            {/* COMPACT POPUP: Eraser Grid */}
            {activePopup === "eraser" && (
              <div
                className="absolute bg-white border-[3px] border-black p-0.5 grid grid-cols-3 gap-0.5 shadow-[8px_8px_0_rgba(0,0,0,0.2)] z-[100] h-fit rounded-[4px]"
                style={{
                  top: "calc(100% - 54px)",
                  right: "8px",
                  width: "140px",
                }}
              >
                {eraserVariants.map((v) => {
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTool("eraser");
                        setEraserVariant(v.id);
                        setActivePopup("none");
                      }}
                      className={`relative border-[2px] w-9 h-9 flex items-center justify-center transition-all rounded-[2px]
                                    ${
                                      eraserVariant === v.id
                                        ? "border-black bg-slate-100"
                                        : "border-[#e7d1b1] bg-white"
                                    }`}
                    >
                      <div
                        className={`${
                          v.id === "eraserCircle"
                            ? "rounded-full"
                            : v.id === "eraserSquare"
                              ? "rounded-none"
                              : "rounded-none w-7 h-2"
                        } bg-white border-[1.5px] ${
                          eraserVariant === v.id
                            ? "border-black"
                            : "border-[#a67c52]"
                        } ${
                          v.id === "eraserCircle" || v.id === "eraserSquare"
                            ? "w-5 h-5"
                            : ""
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. BOTTOM ROW: Slider | Colors | Save */}
      <div className="h-14 shrink-0 flex items-center gap-2 relative z-10">
        {/* Slider */}
        <div className="w-[28%] h-full bg-[#fffdeb] border-[3px] border-[#d2b48c] p-2 flex flex-col justify-center relative overflow-hidden shadow-[3px_3px_0_rgba(210,180,140,0.2)] rounded-[4px]">
          <div
            className="absolute top-1/2 -translate-y-1/2 left-2 right-2 h-6 bg-[#fdfdfd]"
            style={{ clipPath: "polygon(0 80%, 100% 20%, 100% 100%, 0% 100%)" }}
          />
          <input
            type="range"
            min={MIN_PEN_WIDTH}
            max={MAX_PEN_WIDTH}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-full h-8 relative z-10 accent-[#ff6b00] cursor-pointer mix-blend-multiply"
          />
        </div>

        {/* Colors */}
        <div className="flex-1 h-full bg-[#fffdeb] border-[3px] border-[#d2b48c] p-1 flex items-center justify-center gap-1 shadow-[3px_3px_0_rgba(210,180,140,0.2)] rounded-[4px]">
          {palette.map((_c, idx) => {
            const varName = `var(--palette-${idx})`;
            return (
              <button
                type="button"
                key={varName}
                onClick={() => setColor(varName)}
                style={{ backgroundColor: varName }}
                className={`
                              h-8 w-8 rounded-[2px] transition-transform shadow-sm shrink-0 relative
                              ${
                                color === varName
                                  ? "border-black border-[3px] scale-110 z-10 shadow-[0_0_0_2px_rgba(255,255,255,0.8)]"
                                  : "border-white border-[2px] hover:scale-105"
                              }
                          `}
              >
                {color === varName && (
                  <div className="absolute inset-0 border-2 border-white opacity-80 pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>

        {/* Save Button (Faithful Orange Style) */}
        <div className="h-full">
          {exportUrl ? (
            <a
              href={exportUrl}
              download="wiggly-ugomemo.gif"
              className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-t-[#ff9d5c] border-l-[#ff9d5c] border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-[6px] h-full px-3 flex flex-col items-center justify-center active:translate-y-0.5 transition-all text-white font-black"
            >
              <div className="flex items-baseline mb-0.5">
                <span className="text-sm leading-none">GIF</span>
                <span className="text-[11px] leading-none ml-0.5">を</span>
              </div>
              <span className="text-lg leading-none">保存</span>
            </a>
          ) : (
            /* biome-ignore lint/a11y/useSemanticElements: Custom styled button */
            <div
              onClick={onExport}
              onKeyDown={handleButtonKeyDown(onExport)}
              role="button"
              tabIndex={isExporting ? -1 : 0}
              className={`bg-[#ff6b00] border-t-[3px] border-l-[3px] border-t-[#ff9d5c] border-l-[#ff9d5c] border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-[6px] h-full px-3 flex flex-col items-center justify-center active:translate-y-0.5 transition-all text-white font-black cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00] ${isExporting ? "opacity-50 pointer-events-none" : ""}`}
            >
              {isExporting ? (
                <span className="text-lg">...</span>
              ) : (
                <>
                  <div className="flex items-baseline mb-0.5">
                    <span className="text-xs leading-none">GIF</span>
                    <span className="text-[10px] leading-none ml-0.5">を</span>
                  </div>
                  <span className="text-lg leading-none">保存</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EXPORT OVERLAY */}
      {(isExporting || exportUrl) && (
        <div className="absolute inset-0 z-[300] bg-[#ff6b00] flex flex-col items-center p-3 text-white overflow-hidden">
          {/* Close button (Only visible after export or if error) */}
          {!isExporting && (
            <button
              type="button"
              onClick={onCloseExport}
              className="absolute top-2 right-2 z-20 bg-white border-[3px] border-black rounded-[6px] w-9 h-9 flex items-center justify-center text-xl font-black text-black active:translate-y-0.5 shadow-md"
            >
              ×
            </button>
          )}

          <div className="relative z-10 flex flex-col items-center w-full h-full justify-center max-w-sm gap-3">
            {isExporting ? (
              <div className="flex flex-col items-center gap-6">
                {/* Spinner */}
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 border-3 border-white/20 rounded-full" />
                  <div className="absolute inset-0 border-3 border-white border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-lg font-black tracking-tighter drop-shadow-md">
                    GIFを生成中...
                  </span>
                </div>
              </div>
            ) : exportError ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="text-3xl">⚠️</div>
                <span className="text-lg font-black tracking-tighter drop-shadow-md">
                  GIF生成に失敗しました
                </span>
                <span className="text-xs opacity-80">{exportError}</span>
                <button
                  type="button"
                  onClick={onCloseExport}
                  className="bg-white text-[#ff6b00] border-[3px] border-black rounded-[6px] px-5 py-1.5 font-black text-base active:translate-y-0.5 transition-all"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full gap-2.5">
                <div className="bg-white p-0.5 rounded-[6px] border-[3px] border-black shadow-[6px_6px_0_rgba(0,0,0,0.2)] w-[75%] aspect-[3/2] flex items-center justify-center overflow-hidden">
                  {exportUrl && (
                    <>
                      {/* biome-ignore lint/performance/noImgElement: エクスポートされたGIF表示のため */}
                      <img
                        src={exportUrl}
                        alt="Generated GIF"
                        className="w-full h-full object-contain image-rendering-pixelated"
                      />
                    </>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1 text-center mt-1.5">
                  <p className="text-xs font-black leading-tight">
                    {isMobile()
                      ? "↑スマホの場合は長押しで保存"
                      : "↑右クリックで保存できます"}
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full px-6 mt-3">
                  <a
                    href={exportUrl || "#"}
                    download="wiggly-ugomemo.gif"
                    className="bg-white text-[#ff6b00] border-t-[3px] border-l-[3px] border-t-white border-l-white border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-[6px] py-2 flex items-center justify-center active:translate-y-0.5 transition-all font-black text-lg shadow-lg"
                  >
                    保存する
                  </a>
                  <ShareButton
                    text="うごメモで絵を描いたよ！ #wigglyugomemo"
                    imageUrl={exportUrl || undefined}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL SCREEN SETTINGS MODAL */}
      {activePopup === "settings" && (
        <div className="absolute inset-0 z-[200] bg-[#fdfbf7] flex flex-col overflow-hidden">
          {/* Background Grid (Consistent with main screen) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.12] z-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, #ff8c00 1.5px, transparent 1.5px),
                linear-gradient(to bottom, #ff8c00 1.5px, transparent 1.5px)
              `,
              backgroundSize: "16px 16px",
            }}
          />

          {/* Top Bar: Tabs & Close */}
          <div className="h-14 shrink-0 bg-[#ff6b00] border-b-[4px] border-[#b34700] flex items-center px-2 gap-2 relative z-10">
            <div className="flex-1 flex h-full items-end gap-1 pt-1.5">
              <button
                type="button"
                onClick={() => setSettingsTab("palette")}
                className={`px-5 py-1.5 rounded-t-[8px] font-black text-base transition-all ${
                  settingsTab === "palette"
                    ? "bg-[#fdfbf7] text-[#ff6b00] translate-y-px border-t-[3px] border-l-[3px] border-r-[3px] border-[#e7d1b1]"
                    : "bg-[#ff9d5c] text-white hover:bg-[#ff8c00]"
                }`}
              >
                パレット
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("body")}
                className={`hidden sm:block px-5 py-1.5 rounded-t-[8px] font-black text-base transition-all ${
                  settingsTab === "body"
                    ? "bg-[#fdfbf7] text-[#ff6b00] translate-y-px border-t-[3px] border-l-[3px] border-r-[3px] border-[#e7d1b1]"
                    : "bg-[#ff9d5c] text-white hover:bg-[#ff8c00]"
                }`}
              >
                本体色
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActivePopup("none")}
              className="bg-white border-[3px] border-black rounded-[6px] w-10 h-10 flex items-center justify-center text-2xl font-black active:translate-y-0.5"
            >
              ×
            </button>
          </div>

          {/* Content Area with Custom Scrollbar */}
          <div className="flex-1 overflow-y-auto ugo-scrollbar p-3 relative z-10">
            {settingsTab === "palette" ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PALETTE_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.name}
                      onClick={() => setPalette(p.colors)}
                      className={`flex flex-col p-2 rounded-[4px] border-[3px] transition-all relative overflow-hidden ${
                        JSON.stringify(palette) === JSON.stringify(p.colors)
                          ? "border-black bg-[#ffff00] shadow-[4px_4px_0_rgba(0,0,0,0.1)]"
                          : "border-[#e7d1b1] bg-white hover:border-[#ff9d5c] shadow-[2px_2px_0_rgba(210,180,140,0.1)]"
                      }`}
                    >
                      <span
                        className={`font-black text-xs mb-1.5 text-left ${JSON.stringify(palette) === JSON.stringify(p.colors) ? "text-black" : "text-[#a67c52]"}`}
                      >
                        {p.name}
                      </span>
                      <div className="flex gap-1">
                        {p.colors.map((c) => (
                          <div
                            key={`preview-${c}`}
                            className="w-full aspect-square border-[1.5px] border-black/20 rounded-[2px]"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Palette Option */}
                <div className="mt-1.5 p-3 bg-white border-[3px] border-[#e7d1b1] rounded-[6px] shadow-[2px_2px_0_rgba(210,180,140,0.1)]">
                  <span className="font-black text-base mb-3 block text-center text-[#a67c52]">
                    カスタムパレット
                  </span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {palette.map((c, idx) => (
                      <div
                        key={`custom-palette-${idx}`}
                        className="flex flex-col items-center gap-1 relative"
                      >
                        <div className="w-full aspect-square relative">
                          <div
                            className="absolute inset-0 border-[2.5px] border-black/10 rounded-[4px]"
                            style={{ backgroundColor: c }}
                          />
                          <div className="absolute inset-0 border-[1.5px] border-white/30 rounded-[3px] pointer-events-none" />
                        </div>
                        <span className="text-xs font-black text-[#a67c52] leading-none">
                          {c.toUpperCase()}
                        </span>
                        <input
                          type="color"
                          value={c}
                          onChange={(e) => {
                            const newPalette = [...palette];
                            newPalette[idx] = e.target.value;
                            setPalette(newPalette);
                          }}
                          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-5 gap-2">
                  {BODY_PRESETS.map((b) => (
                    <button
                      type="button"
                      key={b.name}
                      onClick={() => setBodyColor(b.body)}
                      className={`aspect-square rounded-[4px] border-[3px] transition-all relative flex items-center justify-center p-1 ${
                        JSON.stringify(bodyColor) === JSON.stringify(b.body)
                          ? "border-black bg-[#ffff00] shadow-[3px_3px_0_rgba(0,0,0,0.15)] z-10"
                          : "border-[#e7d1b1] bg-white hover:border-[#ff9d5c] shadow-[1px_1px_0_rgba(210,180,140,0.1)]"
                      }`}
                    >
                      <div
                        className="w-full h-full relative border-[2.5px] border-black/10 rounded-[3px] shadow-inner overflow-hidden"
                        style={{ backgroundColor: b.body.bg }}
                      >
                        <div className="absolute top-0 left-0 w-full h-[30%] bg-white/10" />
                        <div className="absolute inset-0 border border-white/20" />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Body Color Option - More compact */}
                <div className="p-2.5 bg-white border-[3px] border-[#e7d1b1] rounded-[6px] flex items-center gap-3 shadow-[2px_2px_0_rgba(210,180,140,0.1)]">
                  <div className="flex-1">
                    <span className="font-black text-xs block text-[#a67c52] leading-tight">
                      カスタムカラー
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 relative">
                    <span className="font-black text-[10px] text-[#a67c52] font-mono">
                      {bodyColor.bg.toUpperCase()}
                    </span>
                    <div className="w-14 h-8 shrink-0 relative">
                      <div
                        className="absolute inset-0 rounded-[4px] border-[3px] border-black/20 shadow-inner"
                        style={{ backgroundColor: bodyColor.bg }}
                      />
                      <div className="absolute inset-0 border-[1.5px] border-white/20 rounded-[3px] pointer-events-none" />
                    </div>
                    <input
                      type="color"
                      value={bodyColor.bg}
                      onChange={(e) => {
                        const base = e.target.value;
                        setBodyColor(generateBodyColorFromBase(base));
                      }}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
