"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BODY_PRESETS, PALETTE_PRESETS } from "@/config/presets";
import type { JitterConfig } from "@/core/jitter";
import type { BrushPatternId } from "@/core/types";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import type { Tool, WigglyEngine } from "@/engine/WigglyEngine";
import { CanvasRenderer } from "@/infra/canvas/CanvasRenderer";
import { exportDrawingAsGif } from "@/infra/exportGif";
import { GifEncGifEncoder } from "@/infra/GifEncGifEncoder";
import { initializeUISounds, uiSoundManager } from "@/infra/sound/uiSounds";
import { useWigglyEngineSync } from "@/ui/hooks/useWigglyEngineSync";
import { DesktopLayout } from "@/ui/layouts/DesktopLayout";
import { MobileLayout } from "@/ui/layouts/MobileLayout";
import { WigglyCanvas } from "@/ui/WigglyCanvas";
import { WigglyTools, type WigglyToolsHandle } from "@/ui/WigglyTools";

const defaultPalette = PALETTE_PRESETS[0];

// 標準DSホワイト本体
const defaultBodyColor = BODY_PRESETS[0].body;

/** デフォルトのペン幅（engine/variants.tsのdefaultPenWidth.penCircleと揃える） */
const DEFAULT_PEN_WIDTH = 16;

// Centralize modular navigation to keep cycling math consistent.
const cycleIndex = (
  current: number,
  length: number,
  direction: 1 | -1,
): number => (current + direction + length) % length;

/** 画面全体の描画UIを提供するエディタ */
export function WigglyEditor() {
  const engineRef = useRef<WigglyEngine | null>(null);
  const toolsRef = useRef<WigglyToolsHandle | null>(null);
  const [engine, setEngine] = useState<WigglyEngine | null>(null);

  // 音源の初期化（初回のみ）
  useEffect(() => {
    initializeUISounds();
  }, []);

  // 状態
  const [tool, setTool] = useState<Tool>("pen");
  const [colorIndex, setColorIndex] = useState(0);
  const [brushWidth, setBrushWidth] = useState(DEFAULT_PEN_WIDTH);
  const [penVariant, setPenVariant] = useState<PenVariant>("penCircle");
  const [eraserVariant, setEraserVariant] =
    useState<EraserVariant>("eraserCircle");
  const [patternId, setPatternId] = useState<BrushPatternId>("dot_sparse");

  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // パレット/本体色の状態
  const [palette, setPalette] = useState(defaultPalette.colors);
  const [customPalette, setCustomPalette] = useState([
    ...defaultPalette.colors,
  ]);
  const [selectedPaletteName, setSelectedPaletteName] = useState<string | null>(
    PALETTE_PRESETS[0].name,
  );
  const [bodyColor, setBodyColor] = useState(defaultBodyColor);
  const [backgroundColor, setBackgroundColor] = useState(
    defaultPalette.background,
  );
  const [customBackgroundColor, setCustomBackgroundColor] = useState(
    defaultPalette.background,
  );
  const [jitterConfig, setJitterConfig] = useState<JitterConfig>({
    amplitude: 1.2,
    frequency: 0.008,
  });

  // レイアウト状態
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    /** 画面幅からレイアウト種別を判定する */
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // グローバルショートカット（Ctrl/Cmd+Z/Yはやり直し/進むのみ）
  useEffect(() => {
    /** undo/redoショートカットを処理する */
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

  /** GIFエクスポートを実行する */
  const handleExportGif = async () => {
    const engine = engineRef.current;
    const drawing = engine?.getDrawing();
    if (!engine || !drawing) return;
    const drawingRevision = engine.getDrawingRevision();

    setIsExporting(true);
    setExportError(null);

    // ローディングUIを描画するためイベントループに処理を譲る
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const offscreen = document.createElement("canvas");
      offscreen.width = drawing.width;
      offscreen.height = drawing.height;
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("2D context not available");

      // GIF出力用（オフスクリーンキャンバスにはDPRスケーリングなし）
      // 現在の背景色を使用
      const renderer = new CanvasRenderer({
        ctx,
        backgroundColor,
        paletteColors: palette,
      });

      const gifEncoder = new GifEncGifEncoder();
      gifEncoder.setBackgroundColor(backgroundColor);
      const blob = await exportDrawingAsGif({
        drawing,
        drawingRevision,
        renderer,
        gif: gifEncoder,
        jitterConfig,
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
    setEngine(engine);
    engine.setHistoryChangeListener(() => {
      setCanUndo(engine.canUndo());
      setCanRedo(engine.canRedo());
    });
    // 初期チェック
    setCanUndo(engine.canUndo());
    setCanRedo(engine.canRedo());
  }, []);

  useWigglyEngineSync({
    engine,
    tool,
    colorIndex,
    brushWidth,
    penVariant,
    eraserVariant,
    patternId,
    backgroundColor,
    jitterConfig,
    palette,
  });

  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  // DSボタン操作
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
    const nextIndex = cycleIndex(currentIndex, toolCycle.length, 1);
    setTool(toolCycle[nextIndex]);
  }, [tool]);

  const handleDSButtonY = useCallback(() => {
    uiSoundManager.play("ds-button-y", { stopPrevious: true });
    const toolCycle: Tool[] = ["pen", "pattern", "eraser"];
    const currentIndex = toolCycle.indexOf(tool);
    const nextIndex = cycleIndex(currentIndex, toolCycle.length, -1);
    setTool(toolCycle[nextIndex]);
  }, [tool]);

  const handleDSButtonUp = useCallback(() => {
    uiSoundManager.play("ds-button-up", { stopPrevious: true });
    const currentPaletteIndex = selectedPaletteName
      ? PALETTE_PRESETS.findIndex((p) => p.name === selectedPaletteName)
      : -1;
    const nextPreset =
      currentPaletteIndex === -1
        ? PALETTE_PRESETS[0]
        : PALETTE_PRESETS[
            cycleIndex(currentPaletteIndex, PALETTE_PRESETS.length, 1)
          ];
    setPalette(nextPreset.colors);
    setBackgroundColor(nextPreset.background);
    setSelectedPaletteName(nextPreset.name);
  }, [selectedPaletteName]);

  const handleDSButtonDown = useCallback(() => {
    uiSoundManager.play("ds-button-down", { stopPrevious: true });
    const currentPaletteIndex = selectedPaletteName
      ? PALETTE_PRESETS.findIndex((p) => p.name === selectedPaletteName)
      : -1;
    const prevPreset =
      currentPaletteIndex === -1
        ? PALETTE_PRESETS[PALETTE_PRESETS.length - 1]
        : PALETTE_PRESETS[
            cycleIndex(currentPaletteIndex, PALETTE_PRESETS.length, -1)
          ];
    setPalette(prevPreset.colors);
    setBackgroundColor(prevPreset.background);
    setSelectedPaletteName(prevPreset.name);
  }, [selectedPaletteName]);

  const handleDSButtonRight = useCallback(() => {
    uiSoundManager.play("ds-button-right", { stopPrevious: true });
    if (palette.length === 0) return;
    const nextIndex = cycleIndex(colorIndex, palette.length, 1);
    setColorIndex(nextIndex);
  }, [colorIndex, palette.length]);

  const handleDSButtonLeft = useCallback(() => {
    uiSoundManager.play("ds-button-left", { stopPrevious: true });
    if (palette.length === 0) return;
    const prevIndex = cycleIndex(colorIndex, palette.length, -1);
    setColorIndex(prevIndex);
  }, [colorIndex, palette.length]);

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
        // biome-ignore lint/security/noDangerouslySetInnerHtml: 固定CSSでユーザー入力を含まないため
        dangerouslySetInnerHTML={{
          __html: `
        :root {
          ${palette.map((c, i) => `--palette-${i}: ${c};`).join("\n")}
          --zako-body-bg: ${bodyColor.bg};
          --zako-body-border: ${bodyColor.border};
          --zako-bezel-bg: ${bodyColor.bezel};
          --zako-bezel-border: ${bodyColor.bezelBorder};
          --zako-button-bg: ${bodyColor.button};
          --zako-button-border: ${bodyColor.buttonBorder};
          --zako-button-text: ${bodyColor.buttonText};
          --zako-hinge-from: ${bodyColor.hingeFrom};
          --zako-hinge-via: ${bodyColor.hingeVia};
          --zako-hinge-to: ${bodyColor.hingeTo};
          --zako-hinge-border: ${bodyColor.hingeBorder};
        }

        /* カスタムスクロールバー（うごメモ風） */
        .zako-scrollbar::-webkit-scrollbar {
          width: 16px;
        }
        .zako-scrollbar::-webkit-scrollbar-track {
          background: var(--color-zako-cream);
          border-left: 3px solid var(--color-zako-tan-light);
        }
        .zako-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-zako-orange-strong);
          border: 4px solid var(--color-zako-cream);
          border-radius: 4px;
          box-shadow: inset -1.5px -1.5px 0 var(--color-zako-black-25), inset 1.5px 1.5px 0 var(--color-zako-white-35);
        }
        .zako-scrollbar {
          scrollbar-width: auto;
          scrollbar-color: var(--color-zako-orange-strong) var(--color-zako-cream);
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
            tool={tool}
            brushWidth={brushWidth}
            eraserVariant={eraserVariant}
            paletteColors={palette}
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
            colorIndex={colorIndex}
            setColorIndex={setColorIndex}
            brushWidth={brushWidth}
            setBrushWidth={setBrushWidth}
            penVariant={penVariant}
            setPenVariant={setPenVariant}
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
            customPalette={customPalette}
            setCustomPalette={setCustomPalette}
            selectedPaletteName={selectedPaletteName}
            setSelectedPaletteName={setSelectedPaletteName}
            bodyColor={bodyColor}
            setBodyColor={setBodyColor}
            setBackgroundColor={setBackgroundColor}
            customBackgroundColor={customBackgroundColor}
            setCustomBackgroundColor={setCustomBackgroundColor}
            jitterConfig={jitterConfig}
            setJitterConfig={setJitterConfig}
          />
        }
      />
    </>
  );
}
