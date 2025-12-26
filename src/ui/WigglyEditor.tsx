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

/** デフォルトのペン幅（engine/variants.tsのdefaultPenWidth.normalと揃える） */
const DEFAULT_PEN_WIDTH = 16;

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
  // penVariantは現在"normal"のみなので定数として扱う
  const penVariant: PenVariant = "normal";
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
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // グローバルショートカット（Ctrl/Cmd+Z/Yはやり直し/進むのみ）
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
    const nextIndex = (currentIndex + 1) % toolCycle.length;
    setTool(toolCycle[nextIndex]);
  }, [tool]);

  const handleDSButtonY = useCallback(() => {
    uiSoundManager.play("ds-button-y", { stopPrevious: true });
    const nextIndex = (colorIndex + 1) % palette.length;
    setColorIndex(nextIndex);
  }, [colorIndex, palette.length]);

  const handleDSButtonUp = useCallback(() => {
    uiSoundManager.play("ds-button-up", { stopPrevious: true });
    // TODO: 将来的に別機能を割り当てる（例: ブラシサイズ変更、ツール切り替えなど）
  }, []);

  const handleDSButtonDown = useCallback(() => {
    uiSoundManager.play("ds-button-down", { stopPrevious: true });
    // TODO: 将来的に別機能を割り当てる（例: ブラシサイズ変更、ツール切り替えなど）
  }, []);

  const handleDSButtonRight = useCallback(() => {
    uiSoundManager.play("ds-button-right", { stopPrevious: true });
    const currentPaletteIndex = selectedPaletteName
      ? PALETTE_PRESETS.findIndex((p) => p.name === selectedPaletteName)
      : -1;
    const nextIndex =
      currentPaletteIndex === -1
        ? 0
        : (currentPaletteIndex + 1) % PALETTE_PRESETS.length;
    const nextPreset = PALETTE_PRESETS[nextIndex];
    setPalette(nextPreset.colors);
    setBackgroundColor(nextPreset.background);
    setSelectedPaletteName(nextPreset.name);
  }, [selectedPaletteName]);

  const handleDSButtonLeft = useCallback(() => {
    uiSoundManager.play("ds-button-left", { stopPrevious: true });
    const currentPaletteIndex = selectedPaletteName
      ? PALETTE_PRESETS.findIndex((p) => p.name === selectedPaletteName)
      : -1;
    const prevIndex =
      currentPaletteIndex <= 0
        ? PALETTE_PRESETS.length - 1
        : currentPaletteIndex - 1;
    const prevPreset = PALETTE_PRESETS[prevIndex];
    setPalette(prevPreset.colors);
    setBackgroundColor(prevPreset.background);
    setSelectedPaletteName(prevPreset.name);
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
        // biome-ignore lint/security/noDangerouslySetInnerHtml: 固定CSSでユーザー入力を含まないため
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

        /* カスタムスクロールバー（うごメモ風） */
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
            backgroundColor={backgroundColor}
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
