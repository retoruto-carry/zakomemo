import type { Drawing, StrokeKind } from "../core/types";
import { appendPoint, clearDrawing, startStroke } from "../core/drawingLogic";
import type { JitterConfig } from "../core/jitter";
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type History,
} from "../core/history";
import { renderDrawingAtTime } from "./frameRenderer";
import type {
  DrawingRenderer,
  RafScheduler,
  StrokeSoundInfo,
  StrokeSound,
  TimeProvider,
} from "./ports";

export type Tool = "pen" | "pattern" | "eraser";

export type EngineOptions = {
  initialDrawing: Drawing;
  renderer: DrawingRenderer;
  time: TimeProvider;
  raf: RafScheduler;
  sound?: StrokeSound;
  jitterConfig: JitterConfig;
};

export class WigglyEngine {
  private history: History<Drawing>;
  private renderer: DrawingRenderer;
  private time: TimeProvider;
  private raf: RafScheduler;
  private sound?: StrokeSound;
  private jitterConfig: JitterConfig;

  private currentTool: Tool = "pen";
  private pendingColor = "#000000";
  private pendingWidth = 4;
  private pendingPattern: BrushSettings["patternId"] = "dots";

  private currentStrokeId: string | null = null;
  private strokeStartTime = 0;
  private strokeLength = 0;
  private strokeStartDrawing: Drawing | null = null;

  private loopId: number | null = null;
  private startedAt: number;
  private lastRenderAt = 0;
  private minFrameIntervalMs = 1000 / 45; // 約45fps目安で間引き

  constructor(options: EngineOptions) {
    this.history = createHistory(options.initialDrawing);
    this.renderer = options.renderer;
    this.time = options.time;
    this.raf = options.raf;
    this.sound = options.sound;
    this.jitterConfig = options.jitterConfig;
    this.startedAt = this.time.now();

    this.loop = this.loop.bind(this);
    this.loopId = this.raf.request(this.loop);
  }

  setTool(tool: Tool): void {
    this.currentTool = tool;
  }

  setBrushColor(color: string): void {
    this.pendingColor = color;
  }

  setBrushWidth(width: number): void {
    this.pendingWidth = width;
  }

  setPattern(patternId: BrushSettings["patternId"]): void {
    this.pendingPattern = patternId;
  }

  pointerDown(x: number, y: number): void {
    const now = this.time.now();
    const strokeId = this.createStrokeId();
    const drawing = this.history.present;
    this.strokeStartDrawing = drawing;

    const strokeKind: StrokeKind = this.currentTool === "eraser" ? "erase" : "draw";
    const brushKind = this.currentTool === "pattern" ? "pattern" : "solid";

    const updated = startStroke(
      drawing,
      strokeId,
      strokeKind,
      {
        kind: brushKind,
        color: this.pendingColor,
        width: this.pendingWidth,
        opacity: 1,
        patternId: brushKind === "pattern" ? this.pendingPattern : undefined,
      },
      { x, y, t: now - this.startedAt }
    );

    this.history = { ...this.history, present: updated };
    this.currentStrokeId = strokeId;
    this.strokeStartTime = now;
    this.strokeLength = 0;

    this.sound?.onStrokeStart({
      tool: this.currentTool,
      speed: 0,
      length: 0,
      timeSinceStart: 0,
    });
  }

  pointerMove(x: number, y: number): void {
    if (!this.currentStrokeId) return;

    const now = this.time.now();
    const drawing = this.history.present;
    const strokes = drawing.strokes;
    const lastStroke = strokes[strokes.length - 1];
    if (!lastStroke) return;

    const lastPoint = lastStroke.points[lastStroke.points.length - 1];
    if (!lastPoint) return;

    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) return;

    this.strokeLength += dist;
    const dt = now - this.strokeStartTime;
    const speed = dt > 0 ? this.strokeLength / dt : 0;

    const updated = appendPoint(drawing, this.currentStrokeId, {
      x,
      y,
      t: now - this.startedAt,
    });

    this.history = { ...this.history, present: updated };

    this.sound?.onStrokeUpdate({
      tool: this.currentTool,
      speed,
      length: this.strokeLength,
      timeSinceStart: now - this.strokeStartTime,
    });
  }

  pointerUp(): void {
    if (!this.currentStrokeId) return;
    const now = this.time.now();

    this.sound?.onStrokeEnd({
      tool: this.currentTool,
      speed: 0,
      length: this.strokeLength,
      timeSinceStart: now - this.strokeStartTime,
    });

    const base = this.strokeStartDrawing ?? this.history.present;
    this.history = pushHistory(
      { ...this.history, present: base, future: [] },
      this.history.present
    );
    this.strokeStartDrawing = null;
    this.currentStrokeId = null;
  }

  undo(): void {
    this.history = undoHistory(this.history);
  }

  redo(): void {
    this.history = redoHistory(this.history);
  }

  getDrawing(): Drawing {
    return this.history.present;
  }

  clear(): void {
    const cleared = clearDrawing(this.history.present);
    this.history = pushHistory(this.history, cleared);
  }

  destroy(): void {
    if (this.loopId !== null) {
      this.raf.cancel(this.loopId);
    }
  }

  private loop(): void {
    const now = this.time.now();
    const elapsed = now - this.startedAt;

    if (now - this.lastRenderAt >= this.minFrameIntervalMs) {
      renderDrawingAtTime(
        this.history.present,
        this.renderer,
        this.jitterConfig,
        elapsed
      );
      this.lastRenderAt = now;
    }

    this.loopId = this.raf.request(this.loop);
  }

  private createStrokeId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `stroke-${Math.random().toString(36).slice(2)}`;
  }
}
