"use client";

import { useEffect, useRef, useState } from "react";
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

export function WigglyEditor() {
  const engineRef = useRef<WigglyEngine | null>(null);

  // State
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#0b0b0b");
  const [width, setWidth] = useState(4);
  const [penVariant, setPenVariant] = useState<PenVariant>("normal");
  const [eraserVariant, setEraserVariant] = useState<EraserVariant>("eraserCircle");
  const [patternId, setPatternId] = useState<BrushPatternId>("dots");

  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  return (
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
          onEngineInit={(engine) => {
            engineRef.current = engine;
          }}
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
          onClear={() => engineRef.current?.clear()}
          onExport={handleExportGif}
          isExporting={isExporting}
          exportUrl={exportUrl}
          exportError={exportError}
        />
      }
    />
  );
}
