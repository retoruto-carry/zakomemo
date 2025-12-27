import type { JitterConfig } from "@/core/jitter";
import type { Drawing } from "@/core/types";
import { WigglyEngine } from "@/engine/WigglyEngine";
import { BrowserRafScheduler } from "@/infra/BrowserRafScheduler";
import { CanvasRenderer } from "@/infra/canvas/CanvasRenderer";
import { RealTimeProvider } from "@/infra/RealTimeProvider";
import { WebAudioStrokeSound } from "@/infra/sound/WebAudioStrokeSound";

/**
 * キャンバスのDPRを考慮して描画コンテキストを初期化する
 */
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

/**
 * ブラウザ向けのWigglyEngineを生成する
 * @param canvas 描画対象のcanvas
 * @param initialDrawing 初期描画データ
 * @param paletteColors パレット配色
 * @param backgroundColor 背景色
 * @param jitterConfig jitter設定
 */
export function createWigglyEngine(
  canvas: HTMLCanvasElement,
  initialDrawing: Drawing,
  paletteColors: string[],
  backgroundColor: string = "#fdfbf7",
  jitterConfig: JitterConfig = { amplitude: 1.2, frequency: 0.008 },
): WigglyEngine {
  const logicalWidth = initialDrawing.width;
  const logicalHeight = initialDrawing.height;
  const ctx = setupCanvasContext(canvas, logicalWidth, logicalHeight);

  const renderer = new CanvasRenderer({
    ctx,
    backgroundColor,
    paletteColors,
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
