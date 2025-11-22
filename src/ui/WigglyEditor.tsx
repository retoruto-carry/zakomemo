"use client";

import { useEffect, useRef, useState } from "react";
import { createWigglyEngine } from "@/app/createWigglyEngine";
import type { BrushPatternId, Drawing } from "@/core/types";
import { exportDrawingAsGif } from "@/engine/exportGif";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import type { Tool, WigglyEngine } from "@/engine/WigglyEngine";
import { CanvasRenderer } from "@/infra/CanvasRenderer";
import { GifEncGifEncoder } from "@/infra/GifEncGifEncoder";
import { eraserVariants, penVariants } from "./variants";

const initialDrawing: Drawing = {
  width: 480,
  height: 320,
  strokes: [],
};

type PointerInfo = {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
};

const palette = [
  "#0b0b0b",
  "#ff3b30",
  "#34c759",
  "#007aff",
  "#fbbf24",
  "#9b51e0",
];

export function WigglyEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WigglyEngine | null>(null);
  const primaryPointerIdRef = useRef<number | null>(null);
  const toolRef = useRef<Tool>("pen");

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#0b0b0b");
  const [width, setWidth] = useState(4);
  const [penVariant, setPenVariant] = useState<PenVariant>("normal");
  const [eraserVariant, setEraserVariant] =
    useState<EraserVariant>("eraserCircle");
  const [patternId, setPatternId] = useState<BrushPatternId>("dots");
  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const activePointersRef = useRef<Map<number, PointerInfo>>(new Map());
  const tapCandidateRef = useRef<PointerInfo | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createWigglyEngine(canvas, initialDrawing);
    engineRef.current = engine;

    canvas.style.touchAction = "none";

    const rectFor = () => canvas.getBoundingClientRect();
    const toCanvasPos = (ev: PointerEvent) => {
      const rect = rectFor();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const handlePointerDown = (ev: PointerEvent) => {
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      const now = performance.now();
      const pos = toCanvasPos(ev);

      activePointersRef.current.set(ev.pointerId, {
        id: ev.pointerId,
        startX: pos.x,
        startY: pos.y,
        startTime: now,
        moved: false,
      });

      if (primaryPointerIdRef.current === null) {
        primaryPointerIdRef.current = ev.pointerId;
        engine.pointerDown(pos.x, pos.y);
        if (engineRef.current && toolRef.current === "eraser") {
          setEraserPos(pos);
        }
      }
    };

    const handlePointerMove = (ev: PointerEvent) => {
      const info = activePointersRef.current.get(ev.pointerId);
      if (!info) return;
      const pos = toCanvasPos(ev);

      const dx = pos.x - info.startX;
      const dy = pos.y - info.startY;
      const dist = Math.hypot(dx, dy);
      if (dist > 10 && !info.moved) {
        activePointersRef.current.set(ev.pointerId, { ...info, moved: true });
      }

      if (ev.pointerId === primaryPointerIdRef.current) {
        engine.pointerMove(pos.x, pos.y);
        if (toolRef.current === "eraser") {
          setEraserPos(pos);
        }
      }
    };

    const handlePointerUp = (ev: PointerEvent) => {
      const info = activePointersRef.current.get(ev.pointerId);
      const pos = toCanvasPos(ev);
      const now = performance.now();

      if (info) {
        const dt = now - info.startTime;
        const dist = Math.hypot(pos.x - info.startX, pos.y - info.startY);
        const wasTap = dt < 220 && dist < 10;

        if (wasTap) {
          const prev = tapCandidateRef.current;
          if (prev && Math.abs(info.startTime - prev.startTime) < 150) {
            engine.undo();
            tapCandidateRef.current = null;
          } else {
            tapCandidateRef.current = info;
            setTimeout(() => {
              if (tapCandidateRef.current?.id === info.id) {
                tapCandidateRef.current = null;
              }
            }, 180);
          }
        }

        activePointersRef.current.delete(ev.pointerId);
      }

      if (ev.pointerId === primaryPointerIdRef.current) {
        engine.pointerUp();
        primaryPointerIdRef.current = null;
        setEraserPos(null);
      }

      canvas.releasePointerCapture(ev.pointerId);
    };

    canvas.addEventListener("pointerdown", handlePointerDown, {
      passive: false,
    });
    canvas.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    return () => {
      engine.destroy();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setTool(tool);
    toolRef.current = tool;
    if (tool !== "eraser") {
      setEraserPos(null);
    }
  }, [tool]);

  useEffect(() => {
    engineRef.current?.setBrushColor(color);
  }, [color]);

  useEffect(() => {
    engineRef.current?.setBrushWidth(width);
  }, [width]);

  useEffect(() => {
    engineRef.current?.setPattern(patternId);
  }, [patternId]);

  useEffect(() => {
    engineRef.current?.setPenVariant(penVariant);
  }, [penVariant]);

  useEffect(() => {
    engineRef.current?.setEraserVariant(eraserVariant);
  }, [eraserVariant]);

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

  const setToolAndState = (next: Tool) => {
    setTool(next);
  };

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Wiggly Ugomemo</h1>
        <p className="text-sm text-slate-600">
          ペンを走らせると線がぷるぷる揺れるドローイング。2本指タップで Undo。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {[
          { id: "pen", label: "✏️ ペン" },
          { id: "pattern", label: "🎨 パターン" },
          { id: "eraser", label: "🩹 消しゴム" },
        ].map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setToolAndState(item.id as Tool)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-transform duration-150 ${
              tool === item.id
                ? "bg-slate-900 text-white shadow-sm scale-[0.99]"
                : "bg-white text-slate-900 border border-slate-200 hover:border-slate-400"
            }`}
          >
            {item.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => engineRef.current?.undo()}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:border-slate-400"
          >
            ⤺ Undo
          </button>
          <button
            type="button"
            onClick={() => engineRef.current?.redo()}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:border-slate-400"
          >
            ⤻ Redo
          </button>
          <button
            type="button"
            onClick={() => engineRef.current?.clear()}
            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:border-rose-300"
          >
            全部消す
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Color
        </span>
        <div className="flex items-center gap-2">
          {palette.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              style={{ background: c }}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                color === c ? "border-slate-900 scale-105" : "border-slate-200"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Size
          </span>
          <input
            type="range"
            min={1}
            max={24}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="h-2 w-40 accent-slate-900"
          />
          <span className="text-xs text-slate-700 w-8 text-right">
            {width}px
          </span>
        </div>
        {tool === "pen" && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Pen Type
            </span>
            <div className="flex flex-wrap gap-2">
              {penVariants.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPenVariant(p.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    penVariant === p.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {tool === "eraser" && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Eraser
            </span>
            <div className="flex flex-wrap gap-2">
              {eraserVariants.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setEraserVariant(v.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    eraserVariant === v.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {tool === "pattern" && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Pattern
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "dots", label: "ドット" },
                  { id: "dotsDense", label: "密ドット" },
                  { id: "horizontal", label: "横線" },
                  { id: "vertical", label: "縦線" },
                  { id: "checker", label: "市松" },
                ] satisfies { id: BrushPatternId; label: string }[]
              ).map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPatternId(p.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    patternId === p.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-100 p-3 flex justify-center">
          <div
            className="relative"
            style={{
              width: initialDrawing.width,
              height: initialDrawing.height,
            }}
          >
            <canvas
              ref={canvasRef}
              width={initialDrawing.width}
              height={initialDrawing.height}
              className="block rounded-lg border border-slate-200 shadow-sm"
              style={{ touchAction: "none", backgroundColor: "#ffffff" }}
            />
            {tool === "eraser" && eraserPos && (
              <div
                className="pointer-events-none absolute border border-black/70"
                style={{
                  width:
                    eraserVariant === "eraserLine"
                      ? Math.max(width * 3, 24)
                      : Math.max(width, 12),
                  height:
                    eraserVariant === "eraserLine"
                      ? Math.max(width * 1.1, 12)
                      : Math.max(width, 12),
                  left: eraserPos.x,
                  top: eraserPos.y,
                  transform: "translate(-50%, -50%)",
                  borderRadius:
                    eraserVariant === "eraserSquare" ? "2px" : "9999px",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.9)",
                }}
              />
            )}
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          スマホでは2本指タップで
          Undo。パターンは紙に印刷された模様のように固定されます。
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportGif}
            disabled={isExporting}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
          >
            {isExporting ? "書き出し中..." : "GIFで保存"}
          </button>
          {exportUrl && (
            <a
              href={exportUrl}
              download="wiggly.gif"
              className="text-xs text-slate-700 underline underline-offset-2"
            >
              ダウンロード
            </a>
          )}
          {exportError && (
            <span className="text-xs text-rose-600">{exportError}</span>
          )}
        </div>
      </div>
    </div>
  );
}
