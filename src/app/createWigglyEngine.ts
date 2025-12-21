import type { Drawing } from "@/core/types";
import { WigglyEngine } from "@/engine/WigglyEngine";
import { BrowserRafScheduler } from "@/infra/BrowserRafScheduler";
import { CanvasRenderer } from "@/infra/CanvasRenderer";
import { HowlerStrokeSound } from "@/infra/HowlerStrokeSound";
import { RealTimeProvider } from "@/infra/RealTimeProvider";

function setupCanvasContext(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function createWigglyEngine(
  canvas: HTMLCanvasElement,
  initialDrawing: Drawing,
): WigglyEngine {
  const logicalWidth = initialDrawing.width;
  const logicalHeight = initialDrawing.height;
  const ctx = setupCanvasContext(canvas, logicalWidth, logicalHeight);

  const jitterConfig = { amplitude: 1.2, frequency: 0.008 };
  const renderer = new CanvasRenderer(ctx);
  const time = new RealTimeProvider();
  const raf = new BrowserRafScheduler();
  const sound = new HowlerStrokeSound();

  return new WigglyEngine({
    initialDrawing,
    renderer,
    time,
    raf,
    sound,
    jitterConfig,
  });
}
