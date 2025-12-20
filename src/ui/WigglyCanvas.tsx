"use client";

import { useEffect, useRef, useState } from "react";
import { createWigglyEngine } from "@/app/createWigglyEngine";
import type { BrushPatternId, Drawing } from "@/core/types";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import type { Tool, WigglyEngine } from "@/engine/WigglyEngine";

const ERASER_GUIDE = {
  minSize: 12,
  squareRadius: 2,
  line: {
    lengthMult: 2,
    height: 2,
  },
} as const;

type PointerInfo = {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
};

interface WigglyCanvasProps {
  initialDrawing: Drawing;
  tool: Tool;
  color: string;
  width: number;
  penVariant: PenVariant;
  eraserVariant: EraserVariant;
  patternId: BrushPatternId;
  onEngineInit: (engine: WigglyEngine) => void;
}

export function WigglyCanvas({
  initialDrawing,
  tool,
  color,
  width,
  penVariant,
  eraserVariant,
  patternId,
  onEngineInit,
}: WigglyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WigglyEngine | null>(null);
  const primaryPointerIdRef = useRef<number | null>(null);
  const activePointersRef = useRef<Map<number, PointerInfo>>(new Map());
  const tapCandidateRef = useRef<PointerInfo | null>(null);
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(
    null
  );

  // Keep a ref to the current tool to access it inside event handlers without re-binding
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // Sync Props to Engine
  useEffect(() => { engineRef.current?.setTool(tool); }, [tool]);
  useEffect(() => { engineRef.current?.setBrushColor(color); }, [color]);
  useEffect(() => { engineRef.current?.setBrushWidth(width); }, [width]);
  useEffect(() => { engineRef.current?.setPattern(patternId); }, [patternId]);
  useEffect(() => { engineRef.current?.setPenVariant(penVariant); }, [penVariant]);
  useEffect(() => { engineRef.current?.setEraserVariant(eraserVariant); }, [eraserVariant]);

  // Initialize Engine and Event Listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createWigglyEngine(canvas, initialDrawing);
    engineRef.current = engine;
    onEngineInit(engine);

    canvas.style.touchAction = "none";

    const rectFor = () => canvas.getBoundingClientRect();
    const toCanvasPos = (ev: PointerEvent) => {
      const rect = rectFor();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const visualX = ev.clientX - rect.left;
      const visualY = ev.clientY - rect.top;

      return {
        visual: { x: visualX, y: visualY },
        internal: { x: visualX * scaleX, y: visualY * scaleY }
      };
    };

    const handlePointerDown = (ev: PointerEvent) => {
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      const now = performance.now();
      const { visual, internal } = toCanvasPos(ev);

      activePointersRef.current.set(ev.pointerId, {
        id: ev.pointerId,
        startX: internal.x,
        startY: internal.y,
        startTime: now,
        moved: false,
      });

      if (primaryPointerIdRef.current === null) {
        primaryPointerIdRef.current = ev.pointerId;
        engine.pointerDown(internal.x, internal.y);

        if (toolRef.current === "eraser") {
          setEraserPos(visual);
        }
      }
    };

    const handlePointerMove = (ev: PointerEvent) => {
      const info = activePointersRef.current.get(ev.pointerId);
      const { visual, internal } = toCanvasPos(ev);

      // Update eraser cursor for hover (mouse/pen) or drag (touch/all)
      if (toolRef.current === "eraser") {
        if (ev.pointerType === "mouse" || ev.pointerType === "pen" || primaryPointerIdRef.current === ev.pointerId) {
          setEraserPos(visual);
        }
      } else {
        setEraserPos(null);
      }

      if (!info) return;

      const dx = internal.x - info.startX;
      const dy = internal.y - info.startY;
      const dist = Math.hypot(dx, dy);
      if (dist > 10 && !info.moved) {
        activePointersRef.current.set(ev.pointerId, { ...info, moved: true });
      }

      if (ev.pointerId === primaryPointerIdRef.current) {
        engine.pointerMove(internal.x, internal.y);
      }
    };

    const handlePointerUp = (ev: PointerEvent) => {
      const info = activePointersRef.current.get(ev.pointerId);
      const { internal } = toCanvasPos(ev);
      const now = performance.now();

      if (info) {
        const dt = now - info.startTime;
        const dist = Math.hypot(internal.x - info.startX, internal.y - info.startY);
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
        if (toolRef.current !== "eraser" || (ev.pointerType === "touch")) {
          setEraserPos(null);
        }
      }
      canvas.releasePointerCapture(ev.pointerId);
    };

    // Use window for move/up to catch drags leaving the canvas (though capture handles most)
    canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
    canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("pointerleave", () => {
      // Hide eraser if pen leaves canvas
      if (toolRef.current === "eraser") { // and not dragging?
        // If dragging (captured), we might still want it? 
        // pointerleave fires even if captured? No, if captured, events go to target.
        // But if not captured (hover), leave fires.
        if (!primaryPointerIdRef.current) setEraserPos(null);
      }
    });

    return () => {
      engine.destroy();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []); // Run once on mount

  return (
    <div className="relative inline-block bg-white box-border w-full h-full touch-none select-none">
      <canvas
        ref={canvasRef}
        width={initialDrawing.width}
        height={initialDrawing.height}
        className="block w-full h-full object-contain touch-none"
        style={{ touchAction: "none" }}
      />
      {tool === "eraser" && eraserPos && (
        <div
          className="pointer-events-none absolute border border-black/70 z-10"
          style={{
            width: eraserVariant === "eraserLine"
              ? Math.max(width * ERASER_GUIDE.line.lengthMult, ERASER_GUIDE.minSize)
              : Math.max(width, ERASER_GUIDE.minSize),
            height: eraserVariant === "eraserLine"
              ? ERASER_GUIDE.line.height
              : Math.max(width, ERASER_GUIDE.minSize),
            left: eraserPos.x,
            top: eraserPos.y,
            transform: "translate(-50%, -50%)",
            borderRadius: eraserVariant === "eraserSquare"
              ? `${ERASER_GUIDE.squareRadius}px`
              : "9999px",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.9)",
          }}
        />
      )}
    </div>
  );
}
