"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JitterConfig } from "@/core/jitter";
import type { BrushPatternId, Drawing } from "@/core/types";
import { exportDrawingAsGif } from "@/engine/exportGif";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import type { Tool, WigglyEngine } from "@/engine/WigglyEngine";
import { CanvasRenderer } from "@/infra/CanvasRenderer";
import { GifEncGifEncoder } from "@/infra/GifEncGifEncoder";
import { initializeUISounds, uiSoundManager } from "@/infra/uiSounds";
import { useTouchUndoRedo } from "@/ui/hooks/useTouchUndoRedo";
import { DesktopLayout } from "./layouts/DesktopLayout";
import { MobileLayout } from "./layouts/MobileLayout";
import {
  BACKGROUND_COLOR_PRESETS,
  BODY_PRESETS,
  PALETTE_PRESETS,
} from "./presets";
import { WigglyCanvas } from "./WigglyCanvas";
import { WigglyTools, type WigglyToolsHandle } from "./WigglyTools";

const initialDrawing: Drawing = {
  width: 960,
  height: 640,
  strokes: [],
};

// Default palette: black, red, green, blue, yellow, purple
const defaultPalette = PALETTE_PRESETS[0].colors;

// Standard DS White body
const defaultBodyColor = BODY_PRESETS[0].body;

/** Default pen width (should match engine/variants.ts defaultPenWidth.normal) */
const DEFAULT_PEN_WIDTH = 16;

export function WigglyEditor() {
  const engineRef = useRef<WigglyEngine | null>(null);
  const toolsRef = useRef<WigglyToolsHandle | null>(null);

  // 音源の初期化（初回のみ）
  useEffect(() => {
    initializeUISounds();
  }, []);

  // State
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("var(--palette-0)");
  const [width, setWidth] = useState(DEFAULT_PEN_WIDTH);
  // penVariantは現在"normal"のみなので定数として扱う
  const penVariant: PenVariant = "normal";
  const [eraserVariant, setEraserVariant] =
    useState<EraserVariant>("eraserCircle");
  const [patternId, setPatternId] = useState<BrushPatternId>("dots");

  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Palette & Body state
  const [palette, setPalette] = useState(defaultPalette);
  const [selectedPaletteName, setSelectedPaletteName] = useState<string | null>(
    PALETTE_PRESETS[0].name,
  );
  const [bodyColor, setBodyColor] = useState(defaultBodyColor);
  const [backgroundColor, setBackgroundColor] = useState("#fdfbf7");
  const [jitterConfig, setJitterConfig] = useState<JitterConfig>({
    amplitude: 1.2,
    frequency: 0.008,
  });

  // Layout State
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Global Keyboard Shortcuts (Ctrl/Cmd + Z/Y for undo/redo only)
  useEffect(() => {
    const handleKey = (ev: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const key = ev.key.toLowerCase();
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && key === "z" && ev.shiftKey) {
        ev.preventDefault();
        engine.redo();
      } else if (mod && key === "y") {
        ev.preventDefault();
        engine.redo();
      } else if (mod && key === "z") {
        ev.preventDefault();
        engine.undo();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Touch Screen Undo/Redo (画面全体に適用)
  const handleTouchUndo = useCallback(() => {
    engineRef.current?.undo();
  }, []);
  const handleTouchRedo = useCallback(() => {
    engineRef.current?.redo();
  }, []);

  useTouchUndoRedo({
    onUndo: handleTouchUndo,
    onRedo: handleTouchRedo,
    enabled: true,
  });

  const handleExportGif = async () => {
    const engine = engineRef.current;
    const drawing = engine?.getDrawing();
    if (!engine || !drawing) return;

    setIsExporting(true);
    setExportError(null);

    // Yield to the event loop to allow the loading UI to render
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const offscreen = document.createElement("canvas");
      offscreen.width = drawing.width;
      offscreen.height = drawing.height;
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("2D context not available");

      // GIF出力用にdpr=1を明示（オフスクリーンキャンバスにはDPRスケーリングなし）
      // 現在の背景色を使用
      const renderer = new CanvasRenderer(ctx, 1, backgroundColor);

      const gifEncoder = new GifEncGifEncoder();
      gifEncoder.setBackgroundColor(backgroundColor);
      const blob = await exportDrawingAsGif({
        drawing,
        renderer,
        gif: gifEncoder,
        jitterConfig,
        fps: 12,
        durationMs: 2000,
      });

      if (exportUrl) URL.revokeObjectURL(exportUrl);
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "GIF export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const onEngineInit = useCallback((engine: WigglyEngine) => {
    engineRef.current = engine;
    engine.setHistoryChangeListener(() => {
      setCanUndo(engine.canUndo());
      setCanRedo(engine.canRedo());
    });
    // Initial check
    setCanUndo(engine.canUndo());
    setCanRedo(engine.canRedo());
  }, []);

  // Sync palette/body changes to engine's pattern cache
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally trigger on palette/bodyColor changes
  useEffect(() => {
    engineRef.current?.clearRendererCache();
  }, [palette, bodyColor]);

  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  // DS Button Handlers
  const handleDSButtonA = useCallback(() => {
    uiSoundManager.play("ds-button-a", { stopPrevious: true });
    engineRef.current?.redo();
  }, []);

  const handleDSButtonB = useCallback(() => {
    uiSoundManager.play("ds-button-b", { stopPrevious: true });
    toolsRef.current?.playUndoAnimation();
    engineRef.current?.undo();
  }, []);

  const handleDSButtonX = useCallback(() => {
    uiSoundManager.play("ds-button-x", { stopPrevious: true });
    const toolCycle: Tool[] = ["pen", "pattern", "eraser"];
    const currentIndex = toolCycle.indexOf(tool);
    const nextIndex = (currentIndex + 1) % toolCycle.length;
    setTool(toolCycle[nextIndex]);
  }, [tool]);

  const handleDSButtonY = useCallback(() => {
    uiSoundManager.play("ds-button-y", { stopPrevious: true });
    let currentIndex = -1;
    if (color.startsWith("var(--palette-")) {
      const parsedIndex = parseInt(
        color.substring("var(--palette-".length, color.length - 1),
        10,
      );
      if (!Number.isNaN(parsedIndex) && parsedIndex >= 0) {
        currentIndex = parsedIndex;
      }
    }
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (safeIndex + 1) % palette.length;
    setColor(`var(--palette-${nextIndex})`);
  }, [color, palette]);

  const handleDSButtonUp = useCallback(() => {
    uiSoundManager.play("ds-button-up", { stopPrevious: true });
    const currentIndex = BACKGROUND_COLOR_PRESETS.indexOf(
      backgroundColor as (typeof BACKGROUND_COLOR_PRESETS)[number],
    );
    if (currentIndex === -1) {
      setBackgroundColor(BACKGROUND_COLOR_PRESETS[0]);
    } else {
      const nextIndex = (currentIndex + 1) % BACKGROUND_COLOR_PRESETS.length;
      setBackgroundColor(BACKGROUND_COLOR_PRESETS[nextIndex]);
    }
  }, [backgroundColor]);

  const handleDSButtonDown = useCallback(() => {
    uiSoundManager.play("ds-button-down", { stopPrevious: true });
    const currentIndex = BACKGROUND_COLOR_PRESETS.indexOf(
      backgroundColor as (typeof BACKGROUND_COLOR_PRESETS)[number],
    );
    if (currentIndex === -1) {
      setBackgroundColor(
        BACKGROUND_COLOR_PRESETS[BACKGROUND_COLOR_PRESETS.length - 1],
      );
    } else {
      const prevIndex =
        currentIndex === 0
          ? BACKGROUND_COLOR_PRESETS.length - 1
          : currentIndex - 1;
      setBackgroundColor(BACKGROUND_COLOR_PRESETS[prevIndex]);
    }
  }, [backgroundColor]);

  const handleDSButtonRight = useCallback(() => {
    uiSoundManager.play("ds-button-right", { stopPrevious: true });
    const currentPaletteIndex = selectedPaletteName
      ? PALETTE_PRESETS.findIndex((p) => p.name === selectedPaletteName)
      : -1;
    if (currentPaletteIndex === -1) {
      setPalette(PALETTE_PRESETS[0].colors);
      setSelectedPaletteName(PALETTE_PRESETS[0].name);
    } else {
      const nextIndex = (currentPaletteIndex + 1) % PALETTE_PRESETS.length;
      setPalette(PALETTE_PRESETS[nextIndex].colors);
      setSelectedPaletteName(PALETTE_PRESETS[nextIndex].name);
    }
  }, [selectedPaletteName]);

  const handleDSButtonLeft = useCallback(() => {
    uiSoundManager.play("ds-button-left", { stopPrevious: true });
    const currentPaletteIndex = selectedPaletteName
      ? PALETTE_PRESETS.findIndex((p) => p.name === selectedPaletteName)
      : -1;
    if (currentPaletteIndex === -1) {
      setPalette(PALETTE_PRESETS[PALETTE_PRESETS.length - 1].colors);
      setSelectedPaletteName(PALETTE_PRESETS[PALETTE_PRESETS.length - 1].name);
    } else {
      const prevIndex =
        currentPaletteIndex === 0
          ? PALETTE_PRESETS.length - 1
          : currentPaletteIndex - 1;
      setPalette(PALETTE_PRESETS[prevIndex].colors);
      setSelectedPaletteName(PALETTE_PRESETS[prevIndex].name);
    }
  }, [selectedPaletteName]);

  const handleDSButtonStart = useCallback(() => {
    uiSoundManager.play("ds-button-start", { stopPrevious: true });
    const currentBodyIndex = BODY_PRESETS.findIndex(
      (b) => JSON.stringify(b.body) === JSON.stringify(bodyColor),
    );
    if (currentBodyIndex === -1) {
      setBodyColor(BODY_PRESETS[0].body);
    } else {
      const nextIndex = (currentBodyIndex + 1) % BODY_PRESETS.length;
      setBodyColor(BODY_PRESETS[nextIndex].body);
    }
  }, [bodyColor]);

  const handleDSButtonSelect = useCallback(() => {
    uiSoundManager.play("ds-button-select", { stopPrevious: true });
    const currentBodyIndex = BODY_PRESETS.findIndex(
      (b) => JSON.stringify(b.body) === JSON.stringify(bodyColor),
    );
    if (currentBodyIndex === -1) {
      setBodyColor(BODY_PRESETS[BODY_PRESETS.length - 1].body);
    } else {
      const prevIndex =
        currentBodyIndex === 0 ? BODY_PRESETS.length - 1 : currentBodyIndex - 1;
      setBodyColor(BODY_PRESETS[prevIndex].body);
    }
  }, [bodyColor]);

  return (
    <>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Static CSS, no user input
        dangerouslySetInnerHTML={{
          __html: `
        :root {
          ${palette.map((c, i) => `--palette-${i}: ${c};`).join("\n")}
          --ugo-body-bg: ${bodyColor.bg};
          --ugo-body-border: ${bodyColor.border};
          --ugo-bezel-bg: ${bodyColor.bezel};
          --ugo-bezel-border: ${bodyColor.bezelBorder};
          --ugo-button-bg: ${bodyColor.button};
          --ugo-button-border: ${bodyColor.buttonBorder};
          --ugo-button-text: ${bodyColor.buttonText};
          --ugo-hinge-from: ${bodyColor.hingeFrom};
          --ugo-hinge-via: ${bodyColor.hingeVia};
          --ugo-hinge-to: ${bodyColor.hingeTo};
          --ugo-hinge-border: ${bodyColor.hingeBorder};
        }

        /* Custom Scrollbar - Ugomemo Style */
        .ugo-scrollbar::-webkit-scrollbar {
          width: 16px;
        }
        .ugo-scrollbar::-webkit-scrollbar-track {
          background: #fdfbf7;
          border-left: 3px solid #e7d1b1;
        }
        .ugo-scrollbar::-webkit-scrollbar-thumb {
          background: #ff6b00;
          border: 4px solid #fdfbf7;
          border-radius: 4px;
          box-shadow: inset -1.5px -1.5px 0 rgba(0,0,0,0.25), inset 1.5px 1.5px 0 rgba(255,255,255,0.35);
        }
        .ugo-scrollbar {
          scrollbar-width: auto;
          scrollbar-color: #ff6b00 #fdfbf7;
        }

        /* スライダーのつまみを大きくする */
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ff6b00;
          border: 3px solid #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          margin-top: -8px;
        }

        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ff6b00;
          border: 3px solid #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          cursor: pointer;
        }

        /* 太さスライダー用のより大きなつまみ */
        input[type="range"].pen-width-slider::-webkit-slider-thumb {
          width: 24px;
          height: 24px;
          margin-top: -4px;
        }

        input[type="range"].pen-width-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
        }
      `,
        }}
      />
      <Layout
        dsButtons={
          isDesktop
            ? {
                onA: handleDSButtonA,
                onB: handleDSButtonB,
                onX: handleDSButtonX,
                onY: handleDSButtonY,
                onUp: handleDSButtonUp,
                onDown: handleDSButtonDown,
                onLeft: handleDSButtonLeft,
                onRight: handleDSButtonRight,
                onStart: handleDSButtonStart,
                onSelect: handleDSButtonSelect,
              }
            : undefined
        }
        canvas={
          <WigglyCanvas
            initialDrawing={initialDrawing}
            tool={tool}
            color={color}
            width={width}
            penVariant={penVariant}
            eraserVariant={eraserVariant}
            patternId={patternId}
            backgroundColor={backgroundColor}
            jitterConfig={jitterConfig}
            onEngineInit={onEngineInit}
          />
        }
        tools={
          <WigglyTools
            ref={toolsRef}
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            width={width}
            setWidth={setWidth}
            eraserVariant={eraserVariant}
            setEraserVariant={setEraserVariant}
            patternId={patternId}
            setPatternId={setPatternId}
            onUndo={() => engineRef.current?.undo()}
            onRedo={() => engineRef.current?.redo()}
            canUndo={canUndo}
            canRedo={canRedo}
            onClear={() => engineRef.current?.clear()}
            onExport={handleExportGif}
            onCloseExport={() => {
              if (exportUrl) URL.revokeObjectURL(exportUrl);
              setExportUrl(null);
            }}
            isExporting={isExporting}
            exportUrl={exportUrl}
            exportError={exportError}
            palette={palette}
            setPalette={setPalette}
            selectedPaletteName={selectedPaletteName}
            setSelectedPaletteName={setSelectedPaletteName}
            bodyColor={bodyColor}
            setBodyColor={setBodyColor}
            backgroundColor={backgroundColor}
            setBackgroundColor={setBackgroundColor}
            jitterConfig={jitterConfig}
            setJitterConfig={setJitterConfig}
          />
        }
      />
    </>
  );
}
