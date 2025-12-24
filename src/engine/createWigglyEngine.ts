import type { JitterConfig } from "@/core/jitter";
import type { Drawing } from "@/core/types";
import { WigglyEngine } from "@/engine/WigglyEngine";
import { BrowserRafScheduler } from "@/infra/BrowserRafScheduler";
import { CanvasRenderer } from "@/infra/canvas/CanvasRenderer";
import { RealTimeProvider } from "@/infra/RealTimeProvider";
import { WebAudioStrokeSound } from "@/infra/sound/WebAudioStrokeSound";

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
  // ピクセルアート用: アンチエイリアスを無効化
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function createWigglyEngine(
  canvas: HTMLCanvasElement,
  initialDrawing: Drawing,
  backgroundColor: string = "#fdfbf7",
  jitterConfig: JitterConfig = { amplitude: 1.2, frequency: 0.008 },
): WigglyEngine {
  const logicalWidth = initialDrawing.width;
  const logicalHeight = initialDrawing.height;
  const ctx = setupCanvasContext(canvas, logicalWidth, logicalHeight);

  const renderer = new CanvasRenderer({
    ctx,
    backgroundColor,
  });
  // レンダラーを初期サイズで初期化（最初のフレーム描画前に必須）
  renderer.clear(logicalWidth, logicalHeight);

  const time = new RealTimeProvider();
  const raf = new BrowserRafScheduler();
  const sound = new WebAudioStrokeSound();

  return new WigglyEngine({
    initialDrawing,
    renderer,
    time,
    raf,
    sound,
    jitterConfig,
  });
}
