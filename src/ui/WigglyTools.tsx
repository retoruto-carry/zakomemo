"use client";

import React, {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BODY_PRESETS,
  type BodyColor,
  generateBodyColorFromBase,
  PALETTE_PRESETS,
} from "@/config/presets";
import type { JitterConfig } from "@/core/jitter";
import { getPatternDefinition, PATTERNS } from "@/core/patterns";
import type { BrushPatternId } from "@/core/types";
import type { EraserVariant } from "@/engine/variants";
import type { Tool } from "@/engine/WigglyEngine";
import { uiSoundManager } from "@/infra/sound/uiSounds";
import { isMobile } from "@/lib/share";
import { throttle } from "@/lib/throttle";
import { AnimatedGif, type AnimatedGifHandle } from "./components/AnimatedGif";
import { PatternPreview } from "./components/PatternPreview";
import { ShareButton } from "./components/ShareButton";
import { eraserVariants } from "./variants";

export interface WigglyToolsHandle {
  playUndoAnimation: () => void;
}

interface JitterControlSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  toFixed: number;
  onChange: (value: number) => void;
}

function JitterControlSlider({
  label,
  value,
  min,
  max,
  step,
  toFixed,
  onChange,
}: JitterControlSliderProps) {
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const playSliderSoundThrottled = useRef(
    throttle(() => {
      uiSoundManager.play("slider-change", { stopPrevious: true });
    }, 100),
  ).current;

  return (
    <div className="p-3 bg-white border-[3px] border-[#e7d1b1] rounded-[6px] shadow-[2px_2px_0_rgba(210,180,140,0.1)]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-black text-sm text-[#a67c52]">{label}</span>
        <span className="font-black text-xs text-[#a67c52] font-mono">
          {value.toFixed(toFixed)}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const newValue = parseFloat(e.target.value);
            onChange(newValue);
            playSliderSoundThrottled();
          }}
          className="w-full h-2 bg-[#fffdeb] rounded-lg appearance-none cursor-pointer accent-[#ff6b00] relative z-10"
          style={{
            background: `linear-gradient(to right, #ff6b00 0%, #ff6b00 ${percentage}%, #fffdeb ${percentage}%, #fffdeb 100%)`,
          }}
        />
      </div>
    </div>
  );
}

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

/** パターンプレビューの1ドットサイズ(px) */
const PATTERN_PREVIEW_PIXEL_SIZE = 2;
const CUSTOM_COLOR_LABELS = [
  "カラー1",
  "カラー2",
  "カラー3",
  "カラー4",
  "カラー5",
  "カラー6",
];

interface WigglyToolsProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  color: string;
  setColor: (color: string) => void;
  brushWidth: number;
  setBrushWidth: (brushWidth: number) => void;
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
  customPalette: string[];
  setCustomPalette: (palette: string[]) => void;
  selectedPaletteName: string | null;
  setSelectedPaletteName: (name: string | null) => void;
  bodyColor: BodyColor;
  setBodyColor: (bodyColor: BodyColor) => void;
  backgroundColor: string;
  setBackgroundColor: (backgroundColor: string) => void;
  customBackgroundColor: string;
  setCustomBackgroundColor: (backgroundColor: string) => void;
  jitterConfig: JitterConfig;
  setJitterConfig: (jitterConfig: JitterConfig) => void;
}

const CUSTOM_PALETTE_NAME = "カスタム";

export const WigglyTools = React.forwardRef<
  WigglyToolsHandle,
  WigglyToolsProps
>(function WigglyTools(
  {
    tool,
    setTool,
    color,
    setColor,
    brushWidth,
    setBrushWidth,
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
    customPalette,
    setCustomPalette,
    selectedPaletteName,
    setSelectedPaletteName,
    bodyColor,
    setBodyColor,
    backgroundColor,
    setBackgroundColor,
    customBackgroundColor,
    setCustomBackgroundColor,
    jitterConfig,
    setJitterConfig,
  }: WigglyToolsProps,
  ref,
) {
  // 開いているポップアップを追跡
  const [activePopup, setActivePopup] = useState<
    "none" | "pattern" | "eraser" | "settings"
  >("none");
  const currentPattern = useMemo(
    () => getPatternDefinition(patternId),
    [patternId],
  );
  const [settingsTab, setSettingsTab] = useState<"palette" | "body" | "jitter">(
    "palette",
  );
  const undoGifRef = useRef<AnimatedGifHandle>(null);
  const playWidthSliderSound = useRef(
    throttle(() => {
      uiSoundManager.play("slider-change", { stopPrevious: true });
    }, 100),
  ).current;
  const playCustomPaletteSound = useRef(
    throttle(() => {
      uiSoundManager.play("custom-palette-color", { stopPrevious: true });
    }, 400),
  ).current;

  const selectCustomPalette = useCallback(() => {
    if (selectedPaletteName !== CUSTOM_PALETTE_NAME) {
      uiSoundManager.play("palette-preset-select", { stopPrevious: true });
    }
    setPalette(customPalette);
    setBackgroundColor(customBackgroundColor);
    setSelectedPaletteName(CUSTOM_PALETTE_NAME);
  }, [
    selectedPaletteName,
    setPalette,
    customPalette,
    setBackgroundColor,
    customBackgroundColor,
    setSelectedPaletteName,
  ]);

  // モバイルで「本体色」タブが選択されている場合、自動的に「パレット」タブに切り替え
  useEffect(() => {
    if (isMobile() && settingsTab === "body") {
      setSettingsTab("palette");
    }
  }, [settingsTab]);

  useImperativeHandle(ref, () => ({
    playUndoAnimation: () => {
      undoGifRef.current?.playAnimation();
    },
  }));

  const handleUndo = () => {
    uiSoundManager.play("button-undo", { stopPrevious: true });
    undoGifRef.current?.playAnimation();
    onUndo();
  };

  // トグル処理
  const handleToolClick = (t: Tool) => {
    // すでに選択中のツールをクリックした場合
    if (tool === t) {
      // パターン/消しゴムはポップアップを切り替え、それ以外は閉じる
      if (t === "pattern") {
        if (activePopup === "pattern") {
          uiSoundManager.play("popup-close", { stopPrevious: true });
        } else {
          uiSoundManager.play("button-tool", { stopPrevious: true });
        }
        setActivePopup(activePopup === "pattern" ? "none" : "pattern");
      } else if (t === "eraser") {
        if (activePopup === "eraser") {
          uiSoundManager.play("popup-close", { stopPrevious: true });
        } else {
          uiSoundManager.play("button-tool", { stopPrevious: true });
        }
        setActivePopup(activePopup === "eraser" ? "none" : "eraser");
      } else {
        if (activePopup !== "none") {
          uiSoundManager.play("popup-close", { stopPrevious: true });
        } else {
          uiSoundManager.play("button-tool", { stopPrevious: true });
        }
        setActivePopup("none");
      }
    } else {
      // 別ツールに切り替える場合は開いているポップアップを閉じ、新規は開かない
      if (activePopup !== "none") {
        uiSoundManager.play("popup-close", { stopPrevious: true });
      } else {
        uiSoundManager.play("button-tool", { stopPrevious: true });
      }
      setTool(t);
      setActivePopup("none");
    }
  };

  return (
    <div className="flex flex-col w-full bg-[#fdfbf7] select-none text-(--color-ugo-dark) font-sans p-2 gap-2 relative overflow-hidden">
      {/* 忠実な走査線・ピクセルテクスチャのオーバーレイ（ポップアップの背面にするためZを低く） */}
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

      {/* 背景グリッド（ブランドカラーのオレンジ） */}
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

      {/* 1. 上段: アクションボタン（オレンジの立体風）- 角配置 */}
      <div className="h-12 shrink-0 relative z-10">
        {/* レイアウト用スペーサー */}
      </div>

      {/* 左: 全消し（消す）- 左上 */}
      <button
        type="button"
        onClick={() => {
          uiSoundManager.play("button-clear", { stopPrevious: true });
          onClear();
        }}
        onKeyDown={handleButtonKeyDown(() => {
          uiSoundManager.play("button-clear", { stopPrevious: true });
          onClear();
        })}
        className="absolute top-0 left-0 bg-[#ff6b00] border-t-[3px] border-l-[3px] border-t-[#ff9d5c] border-l-[#ff9d5c] border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-tl-none rounded-tr-[6px] rounded-bl-none rounded-br-[6px] h-12 px-2 py-1 flex items-center justify-center gap-1 active:translate-y-0.5 active:brightness-95 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00] z-10"
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
      </button>

      {/* 中央左: 設定 */}
      <button
        type="button"
        onClick={() => {
          uiSoundManager.play("button-settings", { stopPrevious: true });
          setActivePopup("settings");
        }}
        onKeyDown={handleButtonKeyDown(() => {
          uiSoundManager.play("button-settings", { stopPrevious: true });
          setActivePopup("settings");
        })}
        className="absolute top-0 left-[calc(94px+2px)] bg-[#ff6b00] border-t-[3px] border-l-[3px] border-t-[#ff9d5c] border-l-[#ff9d5c] border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-[6px] h-12 px-2 py-1 flex items-center justify-center gap-1 active:translate-y-0.5 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00] z-10"
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
      </button>

      {/* 右寄せグループ: やり直し/進む - 右上 */}
      <div className="absolute top-0 right-0 flex h-12 items-stretch z-10">
        {/* やり直し */}
        <button
          type="button"
          onClick={canUndo ? handleUndo : undefined}
          onKeyDown={canUndo ? handleButtonKeyDown(handleUndo) : undefined}
          tabIndex={canUndo ? 0 : -1}
          disabled={!canUndo}
          className={`
              border-t-[3px] border-l-[3px] border-b-[3px] border-r-[1.5px] 
              rounded-tl-[6px] rounded-tr-none rounded-bl-[6px] rounded-br-none h-full px-2 py-1 flex items-center justify-center gap-1 
              transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00]
              ${
                !canUndo
                  ? "bg-[#ffd6b8] border-t-white border-l-[#fffefc] border-b-[#ffb38a] border-r-[#ffb38a] cursor-not-allowed"
                  : "bg-[#ff6b00] border-[#ff9d5c] border-b-[#b34700] border-r-[#b34700] active:translate-y-0.5 active:brightness-95 cursor-pointer"
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
        </button>

        {/* 進む */}
        <button
          type="button"
          onClick={() => {
            uiSoundManager.play("button-redo", { stopPrevious: true });
            onRedo();
          }}
          onKeyDown={handleButtonKeyDown(() => {
            uiSoundManager.play("button-redo", { stopPrevious: true });
            onRedo();
          })}
          tabIndex={canRedo ? 0 : -1}
          disabled={!canRedo}
          className={`
              border-t-[3px] border-l-[1.5px] border-r-[3px] border-b-[3px] 
              rounded-tl-none rounded-tr-none rounded-bl-none rounded-br-none h-full px-2 py-1 flex items-center justify-center 
              transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00]
              ${
                !canRedo
                  ? "bg-[#ffd6b8] border-t-white border-l-[#ffb38a] border-r-[#ffb38a] border-b-[#ffb38a] cursor-not-allowed"
                  : "bg-[#ff6b00] border-t-[#ff9d5c] border-l-[#ff9d5c] border-r-[#b34700] border-b-[#b34700] active:translate-y-0.5 active:brightness-95 cursor-pointer"
              }
            `}
        >
          <div className="text-white text-2xl font-black leading-none">⤻</div>
        </button>
      </div>

      {/* 2. 中段: メインツール（ドット風） */}
      <div className="h-24 shrink-0 flex flex-col justify-center relative z-30 py-0.5">
        <div className="grid grid-cols-3 gap-2.5 items-center">
          {/* ペン */}
          <button
            type="button"
            onClick={() => handleToolClick("pen")}
            onKeyDown={handleButtonKeyDown(() => handleToolClick("pen"))}
            className={`
                  relative flex flex-col items-center justify-center p-1.5 transition-all active:scale-[0.98] w-full h-full rounded-[8px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                  ${
                    tool === "pen"
                      ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-40"
                      : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
                  }
            `}
          >
            <div
              className={`absolute top-2 left-2 text-sm font-black z-50 ${tool === "pen" ? "text-black" : "text-[#a67c52]"}`}
              style={{
                WebkitTextStroke:
                  tool === "pen" ? "3px #fff700" : "3px #fffdeb",
                paintOrder: "stroke fill",
              }}
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
            {/* 角インジケータ（丸） */}
            <div
              className={`absolute bottom-1.5 right-1.5 w-9 h-9 border-[3px] rounded-[3px] flex items-center justify-center z-[90] ${tool === "pen" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}
            >
              <div
                className={`w-4 h-4 rounded-full ${tool === "pen" ? "bg-black" : "bg-[#d2b48c]"}`}
              />
            </div>
          </button>

          {/* ペイント / パターン */}
          <div className="relative w-full h-full">
            <button
              type="button"
              onClick={() => {
                uiSoundManager.play("button-tool", { stopPrevious: true });
                handleToolClick("pattern");
              }}
              onKeyDown={handleButtonKeyDown(() => {
                uiSoundManager.play("button-tool", { stopPrevious: true });
                handleToolClick("pattern");
              })}
              className={`
                  relative flex flex-col items-center justify-center p-1.5 transition-all active:scale-[0.98] w-full h-full rounded-[8px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                  ${
                    tool === "pattern"
                      ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-40"
                      : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
                  }
            `}
            >
              <div
                className={`absolute top-2 left-2 text-sm font-black z-50 ${tool === "pattern" ? "text-black" : "text-[#a67c52]"}`}
                style={{
                  WebkitTextStroke:
                    tool === "pattern" ? "3px #fff700" : "3px #fffdeb",
                  paintOrder: "stroke fill",
                }}
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
            </button>

            {/* 角インジケータ */}
            <button
              type="button"
              onClick={() => {
                if (activePopup === "pattern") {
                  uiSoundManager.play("popup-close", { stopPrevious: true });
                } else {
                  uiSoundManager.play("button-tool", { stopPrevious: true });
                }
                setTool("pattern");
                setActivePopup(activePopup === "pattern" ? "none" : "pattern");
              }}
              onKeyDown={handleButtonKeyDown(() => {
                if (activePopup === "pattern") {
                  uiSoundManager.play("popup-close", { stopPrevious: true });
                } else {
                  uiSoundManager.play("button-tool", { stopPrevious: true });
                }
                setTool("pattern");
                setActivePopup(activePopup === "pattern" ? "none" : "pattern");
              })}
              className={`absolute bottom-1.5 right-1.5 w-9 h-9 border-[3px] rounded-[3px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-[90] focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer ${tool === "pattern" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}
            >
              <PatternPreview
                patternId={patternId}
                pixelSize={PATTERN_PREVIEW_PIXEL_SIZE}
                repeat={currentPattern.previewRepeatTime}
                className={`shadow-inner ${tool === "pattern" ? "opacity-100" : "opacity-50"}`}
              />
            </button>

            {/* 小さなポップアップ: パターングリッド（ドット風） */}
            {activePopup === "pattern" && (
              <div
                className="absolute bg-white border-[3px] border-black p-0.5 grid grid-cols-3 gap-0.5 shadow-[8px_8px_0_rgba(0,0,0,0.2)] z-[150] h-fit rounded-[4px]"
                style={{
                  top: "calc(100% - 54px)",
                  left: "calc(100% - 54px)",
                  width: "140px",
                }}
              >
                {PATTERNS.map((pattern) => {
                  return (
                    <button
                      type="button"
                      key={pattern.id}
                      onClick={() => {
                        uiSoundManager.play("pattern-select", {
                          stopPrevious: true,
                        });
                        setTool("pattern");
                        setPatternId(pattern.id);
                        setActivePopup("none");
                      }}
                      className={`relative border-[2px] w-9 h-9 overflow-hidden bg-white active:scale-95 transition-all rounded-[2px] cursor-pointer flex items-center justify-center ${
                        patternId === pattern.id
                          ? "border-black bg-[#ffff00]/30"
                          : "border-[#e7d1b1]"
                      }`}
                      aria-label={`パターン: ${pattern.id}`}
                    >
                      <PatternPreview
                        patternId={pattern.id}
                        pixelSize={PATTERN_PREVIEW_PIXEL_SIZE}
                        repeat={pattern.previewRepeatTime}
                        className="shadow-inner"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 消しゴム */}
          <div className="relative w-full h-full">
            <button
              type="button"
              onClick={() => {
                uiSoundManager.play("button-tool", { stopPrevious: true });
                handleToolClick("eraser");
              }}
              onKeyDown={handleButtonKeyDown(() => {
                uiSoundManager.play("button-tool", { stopPrevious: true });
                handleToolClick("eraser");
              })}
              className={`
                  relative flex flex-col items-center justify-center p-1.5 transition-all active:scale-[0.98] w-full h-full rounded-[8px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                  ${
                    tool === "eraser"
                      ? "bg-[#fff700] border-[5px] border-black shadow-[6px_6px_0_#000] z-40"
                      : "bg-[#fffdeb] border-[4px] border-[#d2b48c] shadow-[4px_4px_0_rgba(210,180,140,0.3)]"
                  }
            `}
            >
              <div
                className={`absolute top-2 left-2 text-sm font-black z-50 ${tool === "eraser" ? "text-black" : "text-[#a67c52]"}`}
                style={{
                  WebkitTextStroke:
                    tool === "eraser" ? "3px #fff700" : "3px #fffdeb",
                  paintOrder: "stroke fill",
                }}
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
            </button>

            {/* 角インジケータ */}
            <button
              type="button"
              onClick={() => {
                if (activePopup === "eraser") {
                  uiSoundManager.play("popup-close", { stopPrevious: true });
                } else {
                  uiSoundManager.play("button-tool", { stopPrevious: true });
                }
                setTool("eraser");
                setActivePopup(activePopup === "eraser" ? "none" : "eraser");
              }}
              onKeyDown={handleButtonKeyDown(() => {
                if (activePopup === "eraser") {
                  uiSoundManager.play("popup-close", { stopPrevious: true });
                } else {
                  uiSoundManager.play("button-tool", { stopPrevious: true });
                }
                setTool("eraser");
                setActivePopup(activePopup === "eraser" ? "none" : "eraser");
              })}
              className={`absolute bottom-1.5 right-1.5 w-9 h-9 border-[3px] rounded-[3px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-[90] focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer ${tool === "eraser" ? "border-black bg-white" : "border-[#d2b48c] bg-white"}`}
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

            {/* 小さなポップアップ: 消しゴムグリッド */}
            {activePopup === "eraser" && (
              <div
                className="absolute bg-white border-[3px] border-black p-0.5 grid grid-cols-3 gap-0.5 shadow-[8px_8px_0_rgba(0,0,0,0.2)] z-[150] h-fit rounded-[4px]"
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
                      onClick={() => {
                        uiSoundManager.play("eraser-variant-select", {
                          stopPrevious: true,
                        });
                        setTool("eraser");
                        setEraserVariant(v.id);
                        setActivePopup("none");
                      }}
                      className={`relative border-[2px] w-9 h-9 flex items-center justify-center transition-all rounded-[2px] cursor-pointer
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

      {/* 2.5. スライダー行 */}
      <div className="h-8 shrink-0 flex items-center gap-2 relative z-10">
        <span className="text-sm font-black text-[#a67c52] leading-none whitespace-nowrap">
          太さ
        </span>
        <div className="flex-1 flex items-center relative">
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-3 bg-[#fdfdfd]"
            style={{ clipPath: "polygon(0 80%, 100% 20%, 100% 100%, 0% 100%)" }}
          />
          <input
            type="range"
            min={MIN_PEN_WIDTH}
            max={MAX_PEN_WIDTH}
            step={1}
            value={brushWidth}
            onChange={(e) => {
              setBrushWidth(Number(e.target.value));
              playWidthSliderSound();
            }}
            className="pen-width-slider w-full h-4 relative z-10 accent-[#ff6b00] cursor-pointer mix-blend-multiply"
          />
        </div>
      </div>

      {/* 3. 下段: 色 */}
      <div className="h-12 shrink-0 flex items-center justify-start gap-2 relative z-10">
        {/* 色 */}
        <div className="w-fit h-full bg-[#fffdeb] border-[3px] border-[#d2b48c] p-1 flex items-center justify-center gap-1 shadow-[3px_3px_0_rgba(210,180,140,0.2)] rounded-[4px]">
          <div
            className="h-8 w-8 rounded-[2px] shadow-sm shrink-0 relative border-black border-[3px]"
            style={{ backgroundColor }}
          >
            <div className="absolute inset-0 border-2 border-white/40 opacity-80 pointer-events-none" />
          </div>
          <div
            className="w-[3px] h-8 bg-[#d2b48c] rounded-full"
            aria-hidden="true"
          />
          {palette.map((_c, idx) => {
            const varName = `var(--palette-${idx})`;
            return (
              <button
                type="button"
                key={varName}
                onClick={() => {
                  uiSoundManager.play("color-select", { stopPrevious: true });
                  setColor(varName);
                }}
                style={{ backgroundColor: varName }}
                className={`
                              h-8 w-8 rounded-[2px] transition-transform shadow-sm shrink-0 relative cursor-pointer
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
      </div>

      {/* 保存ボタン（オレンジの立体風）- 右下 */}
      <div className="absolute bottom-0 right-0 h-12 z-10">
        {exportUrl ? (
          <a
            href={exportUrl}
            download="wiggly-ugomemo.gif"
            onClick={() => {
              uiSoundManager.play("export-save", { stopPrevious: true });
            }}
            className="bg-[#ff6b00] border-t-[3px] border-l-[3px] border-t-[#ff9d5c] border-l-[#ff9d5c] border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-tl-[6px] rounded-tr-[6px] rounded-bl-none rounded-br-none h-full px-2 py-1 flex items-center justify-center active:translate-y-0.5 transition-all text-white font-black cursor-pointer"
          >
            <span className="text-lg leading-none">GIFを保存</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              uiSoundManager.play("button-export", { stopPrevious: true });
              onExport();
            }}
            onKeyDown={handleButtonKeyDown(() => {
              uiSoundManager.play("button-export", { stopPrevious: true });
              onExport();
            })}
            disabled={isExporting}
            className={`bg-[#ff6b00] border-t-[3px] border-l-[3px] border-t-[#ff9d5c] border-l-[#ff9d5c] border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-tl-[6px] rounded-tr-[6px] rounded-bl-none rounded-br-none h-full px-2 py-1 flex items-center justify-center active:translate-y-0.5 transition-all text-white font-black cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ff6b00] ${isExporting ? "opacity-50 pointer-events-none" : ""}`}
          >
            {isExporting ? (
              <span className="text-lg">...</span>
            ) : (
              <span className="text-lg leading-none">GIFを保存</span>
            )}
          </button>
        )}
      </div>

      {/* エクスポートオーバーレイ */}
      {(isExporting || exportUrl) && (
        <div className="absolute inset-0 z-[300] bg-[#ff6b00] flex flex-col items-center p-3 text-white overflow-hidden">
          {/* 閉じるボタン（エクスポート完了後またはエラー時のみ表示） */}
          {!isExporting && (
            <button
              type="button"
              onClick={() => {
                uiSoundManager.play("export-close", { stopPrevious: true });
                onCloseExport();
              }}
              className="absolute top-2 right-2 z-20 bg-white border-[3px] border-black rounded-[6px] w-9 h-9 flex items-center justify-center text-xl font-black text-black active:translate-y-0.5 shadow-md cursor-pointer"
            >
              ×
            </button>
          )}

          <div className="relative z-10 flex flex-col items-center w-full h-full justify-center max-w-sm gap-3">
            {isExporting ? (
              <div className="flex flex-col items-center gap-6">
                {/* スピナー */}
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
                  onClick={() => {
                    uiSoundManager.play("export-close", { stopPrevious: true });
                    onCloseExport();
                  }}
                  className="bg-white text-[#ff6b00] border-[3px] border-black rounded-[6px] px-5 py-1.5 font-black text-base active:translate-y-0.5 transition-all cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full gap-2.5">
                <div className="bg-white p-0.5 rounded-[6px] border-[3px] border-black shadow-[6px_6px_0_rgba(0,0,0,0.2)] w-[45%] aspect-[3/2] flex items-center justify-center overflow-hidden">
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

                <div className="flex flex-row gap-2 w-full px-6 mt-3">
                  <a
                    href={exportUrl || "#"}
                    download="wiggly-ugomemo.gif"
                    onClick={() => {
                      uiSoundManager.play("export-save", {
                        stopPrevious: true,
                      });
                    }}
                    className="flex-1 bg-white text-[#ff6b00] border-t-[3px] border-l-[3px] border-t-white border-l-white border-b-[3px] border-r-[3px] border-b-[#b34700] border-r-[#b34700] rounded-[6px] py-2 flex items-center justify-center active:translate-y-0.5 transition-all font-black text-lg shadow-lg cursor-pointer"
                  >
                    保存する
                  </a>
                  <ShareButton
                    text="うごメモで絵を描いたよ！ #wigglyugomemo"
                    imageUrl={exportUrl || undefined}
                    className="flex-1"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 全画面設定モーダル */}
      {activePopup === "settings" && (
        <div className="absolute inset-0 z-[200] bg-[#fdfbf7] flex flex-col overflow-hidden">
          {/* 背景グリッド（メイン画面と統一） */}
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

          {/* 上部バー: タブと閉じる */}
          <div className="h-14 shrink-0 bg-[#ff6b00] border-b-[4px] border-[#b34700] flex items-center px-2 gap-2 relative z-10">
            <div className="flex-1 flex h-full items-end gap-1 pt-1.5">
              <button
                type="button"
                onClick={() => {
                  uiSoundManager.play("settings-tab", { stopPrevious: true });
                  setSettingsTab("palette");
                }}
                className={`px-3 py-1.5 rounded-t-[8px] font-black text-sm transition-all cursor-pointer ${
                  settingsTab === "palette"
                    ? "bg-[#fdfbf7] text-[#ff6b00] translate-y-px border-t-[3px] border-l-[3px] border-r-[3px] border-[#e7d1b1]"
                    : "bg-[#ff9d5c] text-white hover:bg-[#ff8c00]"
                }`}
              >
                パレット
              </button>
              {!isMobile() && (
                <button
                  type="button"
                  onClick={() => {
                    uiSoundManager.play("settings-tab", { stopPrevious: true });
                    setSettingsTab("body");
                  }}
                  className={`px-3 py-1.5 rounded-t-[8px] font-black text-sm transition-all cursor-pointer ${
                    settingsTab === "body"
                      ? "bg-[#fdfbf7] text-[#ff6b00] translate-y-px border-t-[3px] border-l-[3px] border-r-[3px] border-[#e7d1b1]"
                      : "bg-[#ff9d5c] text-white hover:bg-[#ff8c00]"
                  }`}
                >
                  本体色
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  uiSoundManager.play("settings-tab", { stopPrevious: true });
                  setSettingsTab("jitter");
                }}
                className={`px-3 py-1.5 rounded-t-[8px] font-black text-sm transition-all cursor-pointer ${
                  settingsTab === "jitter"
                    ? "bg-[#fdfbf7] text-[#ff6b00] translate-y-px border-t-[3px] border-l-[3px] border-r-[3px] border-[#e7d1b1]"
                    : "bg-[#ff9d5c] text-white hover:bg-[#ff8c00]"
                }`}
              >
                ぶるぶる
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                uiSoundManager.play("settings-close", { stopPrevious: true });
                setActivePopup("none");
              }}
              className="bg-white border-[3px] border-black rounded-[6px] w-10 h-10 flex items-center justify-center text-2xl font-black active:translate-y-0.5 cursor-pointer"
            >
              ×
            </button>
          </div>

          {/* コンテンツ領域（カスタムスクロールバー） */}
          <div className="flex-1 overflow-y-auto ugo-scrollbar p-3 relative z-10">
            {settingsTab === "palette" ? (
              <div className="flex flex-col gap-2.5">
                {/* パレットプリセット */}
                <div className="flex flex-col gap-2.5">
                  {PALETTE_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.name}
                      onClick={() => {
                        uiSoundManager.play("palette-preset-select", {
                          stopPrevious: true,
                        });
                        setPalette(p.colors);
                        setBackgroundColor(p.background);
                        setSelectedPaletteName(p.name);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-[4px] border-[3px] transition-all relative overflow-hidden cursor-pointer ${
                        selectedPaletteName === p.name
                          ? "border-black bg-[#ffff00] shadow-[4px_4px_0_rgba(0,0,0,0.1)]"
                          : "border-[#e7d1b1] bg-white hover:border-[#ff9d5c] shadow-[2px_2px_0_rgba(210,180,140,0.1)]"
                      }`}
                    >
                      <span
                        className={`font-black text-sm ${selectedPaletteName === p.name ? "text-black" : "text-[#a67c52]"}`}
                      >
                        {p.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div
                          key={`preview-bg-${p.name}`}
                          className="w-6 h-6 border-[2px] border-black/20 rounded-[3px] shrink-0"
                          style={{ backgroundColor: p.background }}
                        />
                        <div
                          className="w-[3px] h-6 bg-[#e7d1b1] rounded-full"
                          aria-hidden="true"
                        />
                        {p.colors.map((c) => (
                          <div
                            key={`preview-${p.name}-${c}`}
                            className="w-6 h-6 border-[2px] border-black/20 rounded-[3px] shrink-0"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                {/* カスタムパレット */}
                {/* biome-ignore lint/a11y/useSemanticElements: カラーピッカーを含むためdivで選択操作を扱う */}
                <div
                  className={`mt-1.5 p-3 border-[3px] rounded-[6px] transition-all ${
                    selectedPaletteName === CUSTOM_PALETTE_NAME
                      ? "border-black bg-[#ffff00] shadow-[4px_4px_0_rgba(0,0,0,0.1)]"
                      : "border-[#e7d1b1] bg-white shadow-[2px_2px_0_rgba(210,180,140,0.1)]"
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={selectCustomPalette}
                  onKeyDown={handleButtonKeyDown(selectCustomPalette)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-black text-base text-left text-[#a67c52]">
                      カスタムパレット
                    </span>
                    <button
                      type="button"
                      onClick={selectCustomPalette}
                      onKeyDown={handleButtonKeyDown(selectCustomPalette)}
                      className={`px-3 py-1 text-xs font-black border-[2px] rounded-[4px] transition-all ${
                        selectedPaletteName === CUSTOM_PALETTE_NAME
                          ? "border-black bg-white text-black"
                          : "border-[#e7d1b1] bg-[#fffdeb] text-[#a67c52] hover:border-[#ff9d5c]"
                      }`}
                    >
                      {selectedPaletteName === CUSTOM_PALETTE_NAME
                        ? "選択中"
                        : "選択"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="relative flex items-center gap-2">
                      <span className="text-sm font-black text-[#a67c52] w-16 shrink-0">
                        背景
                      </span>
                      <div className="w-8 h-8 relative">
                        <div
                          className="absolute inset-0 border-[2.5px] border-black/10 rounded-[4px]"
                          style={{ backgroundColor: customBackgroundColor }}
                        />
                        <div className="absolute inset-0 border-[1.5px] border-white/30 rounded-[3px] pointer-events-none" />
                      </div>
                      <span className="text-sm font-black text-[#a67c52] leading-none">
                        {customBackgroundColor.toUpperCase()}
                      </span>
                      <input
                        type="color"
                        value={customBackgroundColor}
                        onChange={(e) => {
                          const nextBackground = e.target.value;
                          setCustomBackgroundColor(nextBackground);
                          setBackgroundColor(nextBackground);
                          setPalette(customPalette);
                          setSelectedPaletteName(CUSTOM_PALETTE_NAME);
                          playCustomPaletteSound();
                        }}
                        className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-20"
                      />
                    </div>
                    <div
                      className="h-[3px] w-full bg-[#e7d1b1] rounded-full"
                      aria-hidden="true"
                    />
                    <div className="flex flex-col gap-2">
                      {CUSTOM_COLOR_LABELS.map((label, index) => {
                        const color = customPalette[index] ?? "#000000";
                        return (
                          <div
                            key={label}
                            className="relative flex items-center gap-2"
                          >
                            <span className="text-sm font-black text-[#a67c52] w-16 shrink-0">
                              {label}
                            </span>
                            <div className="w-8 h-8 relative">
                              <div
                                className="absolute inset-0 border-[2.5px] border-black/10 rounded-[4px]"
                                style={{ backgroundColor: color }}
                              />
                              <div className="absolute inset-0 border-[1.5px] border-white/30 rounded-[3px] pointer-events-none" />
                            </div>
                            <span className="text-sm font-black text-[#a67c52] leading-none">
                              {color.toUpperCase()}
                            </span>
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => {
                                const newPalette = [...customPalette];
                                newPalette[index] = e.target.value;
                                setCustomPalette(newPalette);
                                setPalette(newPalette);
                                setBackgroundColor(customBackgroundColor);
                                setSelectedPaletteName(CUSTOM_PALETTE_NAME);
                                playCustomPaletteSound();
                              }}
                              className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-20"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : settingsTab === "jitter" ? (
              <div className="flex flex-col gap-4">
                <JitterControlSlider
                  label="揺れの大きさ"
                  value={jitterConfig.amplitude}
                  min={0}
                  max={3}
                  step={0.1}
                  toFixed={2}
                  onChange={(amplitude) =>
                    setJitterConfig({ ...jitterConfig, amplitude })
                  }
                />
                <JitterControlSlider
                  label="揺れの速さ"
                  value={jitterConfig.frequency}
                  min={0}
                  max={0.02}
                  step={0.001}
                  toFixed={4}
                  onChange={(frequency) =>
                    setJitterConfig({ ...jitterConfig, frequency })
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-6 gap-2 min-w-0">
                  {BODY_PRESETS.map((b) => (
                    <button
                      type="button"
                      key={b.name}
                      onClick={() => {
                        uiSoundManager.play("color-select", {
                          stopPrevious: true,
                        });
                        setBodyColor(b.body);
                      }}
                      className={`w-full aspect-square rounded-[4px] border-[3px] transition-all relative flex items-center justify-center p-1 cursor-pointer min-w-0 ${
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

                {/* カスタム本体色（コンパクト版） */}
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
                        uiSoundManager.play("color-select", {
                          stopPrevious: true,
                        });
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
});
