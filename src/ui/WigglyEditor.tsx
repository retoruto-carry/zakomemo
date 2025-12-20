"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrushPatternId, Drawing } from "@/core/types";
import { exportDrawingAsGif } from "@/engine/exportGif";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import type { Tool, WigglyEngine } from "@/engine/WigglyEngine";
import { CanvasRenderer } from "@/infra/CanvasRenderer";
import { GifEncGifEncoder } from "@/infra/GifEncGifEncoder";

import { WigglyCanvas } from "./WigglyCanvas";
import { WigglyTools } from "./WigglyTools";
import { DesktopLayout } from "./layouts/DesktopLayout";
import { MobileLayout } from "./layouts/MobileLayout";

const initialDrawing: Drawing = {
  width: 960,
  height: 640,
  strokes: [],
};

import { PALETTE_PRESETS, BODY_PRESETS } from "./presets";

// Default palette: black, red, green, blue, yellow, purple
const defaultPalette = PALETTE_PRESETS[0].colors;

// Standard DS White body
const defaultBodyColor = BODY_PRESETS[0].body;

export function WigglyEditor() {
  const engineRef = useRef<WigglyEngine | null>(null);

  // State
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("var(--palette-0)");
  const [width, setWidth] = useState(4);
  const [penVariant, setPenVariant] = useState<PenVariant>("normal");
  const [eraserVariant, setEraserVariant] = useState<EraserVariant>("eraserCircle");
  const [patternId, setPatternId] = useState<BrushPatternId>("dots");

  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Palette & Body state
  const [palette, setPalette] = useState(defaultPalette);
  const [bodyColor, setBodyColor] = useState(defaultBodyColor);

  // Layout State
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Global Keyboard Shortcuts
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

    setIsExporting(true);
    setExportError(null);

    try {
      const offscreen = document.createElement("canvas");
      offscreen.width = drawing.width;
      offscreen.height = drawing.height;
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("2D context not available");

      const renderer = new CanvasRenderer(ctx, {
        amplitude: 0.5,
        frequency: 0.001,
      });

      const gifEncoder = new GifEncGifEncoder();
      const blob = await exportDrawingAsGif({
        drawing,
        renderer,
        gif: gifEncoder,
        jitterConfig: { amplitude: 1.5, frequency: 0.01 },
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
  useEffect(() => {
    engineRef.current?.clearRendererCache();
  }, [palette, bodyColor]);

  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
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
      `}} />
      <Layout
        canvas={
          <WigglyCanvas
            initialDrawing={initialDrawing}
            tool={tool}
            color={color}
            width={width}
            penVariant={penVariant}
            eraserVariant={eraserVariant}
            patternId={patternId}
            onEngineInit={onEngineInit}
          />
        }
        tools={
          <WigglyTools
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            width={width}
            setWidth={setWidth}
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
            isExporting={isExporting}
            exportUrl={exportUrl}
            exportError={exportError}
            palette={palette}
            setPalette={setPalette}
            bodyColor={bodyColor}
            setBodyColor={setBodyColor}
          />
        }
      />
    </>
  );
}
