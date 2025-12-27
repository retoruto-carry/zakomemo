import { appendPoint, clearDrawing, startStroke } from "@/core/drawingLogic";
import {
  createHistory,
  type History,
  pushHistory,
  redoHistory,
  undoHistory,
} from "@/core/history";
import type { JitterConfig } from "@/core/jitter";
import { snapBrushWidth, snapToPixel } from "@/core/rasterization";
import type {
  BrushColor,
  BrushPatternId,
  BrushSettings,
  Drawing,
  StrokeKind,
} from "@/core/types";
import type {
  DrawingRenderer,
  RafScheduler,
  StrokeSound,
  TimeProvider,
} from "@/engine/ports";
import {
  invalidatePendingRequests,
  invalidateRendererCache,
  renderDrawingAtTime,
} from "@/engine/renderScheduler";
import type { EraserVariant, PenVariant } from "@/engine/variants";
import { defaultPenWidth, resolveWidthVariant } from "@/engine/variants";

/** ツール種別 */
export type Tool = "pen" | "pattern" | "eraser";

/** WigglyEngineの初期化パラメータ */
export type EngineOptions = {
  initialDrawing: Drawing;
  renderer: DrawingRenderer;
  time: TimeProvider;
  raf: RafScheduler;
  sound?: StrokeSound;
  jitterConfig: JitterConfig;
};

/**
 * Wiggly描画エンジン
 * 描画の管理、履歴管理、レンダリングループを担当
 */
export class WigglyEngine {
  private history: History<Drawing>;
  private renderer: DrawingRenderer;
  private time: TimeProvider;
  private raf: RafScheduler;
  private sound?: StrokeSound;
  private jitterConfig: JitterConfig;
  private drawingRevision = 0;

  private currentTool: Tool = "pen";
  private pendingColor: BrushColor = { kind: "palette", index: 0 };
  private pendingWidth = defaultPenWidth.normal;
  private penVariant: PenVariant = "normal";
  private eraserVariant: EraserVariant = "eraserCircle";
  private pendingPattern: BrushPatternId = "dot_sparse";

  private currentStrokeId: string | null = null;
  private strokeStartTime = 0;
  private strokeLength = 0;
  private strokeStartDrawing: Drawing | null = null;

  private loopId: number | null = null;
  private startedAt: number;
  private lastRenderAt = 0;
  private minFrameIntervalMs = 1000 / 45; // 約45fps目安で間引き

  private onHistoryChange?: () => void;

  /** エンジンを初期化する */
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

  /** 現在のツールを設定する */
  setTool(tool: Tool): void {
    this.currentTool = tool;
  }

  /** ブラシ色を設定する */
  setBrushColor(color: BrushColor): void {
    this.pendingColor = color;
  }

  /**
   * パレット変更をレンダラーへ同期する
   */
  setPaletteColors(palette: string[]): void {
    if (
      "setPaletteColors" in this.renderer &&
      typeof this.renderer.setPaletteColors === "function"
    ) {
      this.renderer.setPaletteColors(palette);
      this.clearRendererCache();
      this.lastRenderAt = 0;
    }
  }

  /** ブラシ幅を設定する（整数化済み） */
  setBrushWidth(width: number): void {
    this.pendingWidth = snapBrushWidth(width);
  }

  /** ペンのバリアントを設定する */
  setPenVariant(variant: PenVariant): void {
    this.penVariant = variant;
  }

  /** 消しゴムのバリアントを設定する */
  setEraserVariant(variant: EraserVariant): void {
    this.eraserVariant = variant;
  }

  /** パターンIDを設定する */
  setPattern(patternId: BrushPatternId): void {
    this.pendingPattern = patternId;
  }

  /**
   * レンダラーがsetBackgroundColorメソッドを持っている場合のみ有効
   */
  setBackgroundColor(backgroundColor: string): void {
    // setBackgroundColor対応レンダラーのみ適用
    if (
      "setBackgroundColor" in this.renderer &&
      typeof this.renderer.setBackgroundColor === "function"
    ) {
      this.renderer.setBackgroundColor(backgroundColor);
      // 背景色変更前のリクエストを無効化して古いImageBitmapを捨てる
      invalidatePendingRequests(this.renderer);
      // 背景色変更を即座に反映するために次の描画を強制
      this.lastRenderAt = 0;
    }
  }

  /**
   * jitter設定を変更し、即座に再レンダリングを実行
   * jitterConfigが変わると、同じDrawingでも異なるjitterが適用されるため、
   * キャッシュを無効化する必要がある
   */
  setJitterConfig(jitterConfig: JitterConfig): void {
    this.jitterConfig = jitterConfig;
    // jitterConfigが変わるとキャッシュが無効になるため、キャッシュをクリア
    this.clearRendererCache();
    // jitter変更を即座に反映するために次の描画を強制
    this.lastRenderAt = 0;
  }

  /** 履歴変更時の通知を設定する */
  setHistoryChangeListener(listener: () => void): void {
    this.onHistoryChange = listener;
  }

  /**
   * レンダラーのキャッシュと保留中リクエストを無効化する
   */
  clearRendererCache(): void {
    // キャッシュ無効化と保留中リクエスト破棄をまとめて実行
    invalidateRendererCache(this.renderer);
  }

  /** undo可能かどうか */
  canUndo(): boolean {
    return this.history.past.length > 0;
  }

  /** redo可能かどうか */
  canRedo(): boolean {
    return this.history.future.length > 0;
  }

  /** 描画開始（ポインターダウン） */
  pointerDown(x: number, y: number): void {
    // 座標を整数ピクセルにスナップ
    const snapped = snapToPixel(x, y);
    const now = this.time.now();
    const strokeId = this.createStrokeId();
    const drawing = this.history.present;
    this.strokeStartDrawing = drawing;

    const strokeKind: StrokeKind =
      this.currentTool === "eraser" ? "erase" : "draw";
    const brushKind = this.currentTool === "pattern" ? "pattern" : "solid";
    const variant: PenVariant | EraserVariant =
      strokeKind === "erase" ? this.eraserVariant : this.penVariant;

    const brush: BrushSettings =
      brushKind === "pattern"
        ? {
            kind: "pattern",
            color: this.pendingColor,
            width: this.pendingWidth,
            opacity: 1,
            patternId: this.pendingPattern,
            variant,
          }
        : {
            kind: "solid",
            color: this.pendingColor,
            width: this.pendingWidth,
            opacity: 1,
            variant,
          };

    const updated = startStroke(drawing, strokeId, strokeKind, brush, {
      x: snapped.x,
      y: snapped.y,
      t: now - this.startedAt,
    });

    this.history = { ...this.history, present: updated };
    this.bumpDrawingRevision();
    this.currentStrokeId = strokeId;
    this.strokeStartTime = now;
    this.strokeLength = 0;

    // レンダラーがsetIsDrawingActiveメソッドを持っている場合、描画開始を通知
    if (
      "setIsDrawingActive" in this.renderer &&
      typeof this.renderer.setIsDrawingActive === "function"
    ) {
      this.renderer.setIsDrawingActive(true);
    }

    this.sound?.onStrokeStart({
      tool: this.currentTool,
      speed: 0,
      length: 0,
      timeSinceStart: 0,
    });
  }

  /** 描画中のポイント追加（ポインタームーブ） */
  pointerMove(x: number, y: number): void {
    if (!this.currentStrokeId) return;

    // 座標を整数ピクセルにスナップ
    const snapped = snapToPixel(x, y);
    const now = this.time.now();
    const drawing = this.history.present;
    const strokes = drawing.strokes;
    const lastStroke = strokes[strokes.length - 1];
    if (!lastStroke) return;

    const lastPoint = lastStroke.points[lastStroke.points.length - 1];
    if (!lastPoint) return;

    const dx = snapped.x - lastPoint.x;
    const dy = snapped.y - lastPoint.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) return;

    const variant: PenVariant | EraserVariant =
      lastStroke.kind === "erase" ? this.eraserVariant : this.penVariant;
    const adjustedWidth = resolveWidthVariant(
      lastStroke.brush.width,
      variant,
      dist,
      now - this.strokeStartTime,
      lastStroke.kind,
    );

    this.strokeLength += dist;
    const dt = now - this.strokeStartTime;
    const speed = dt > 0 ? this.strokeLength / dt : 0;

    const updated = appendPoint(drawing, this.currentStrokeId, {
      x: snapped.x,
      y: snapped.y,
      t: now - this.startedAt,
    });

    const strokesWithWidth = updated.strokes.map((s) =>
      s.id === this.currentStrokeId
        ? { ...s, brush: { ...s.brush, width: adjustedWidth } }
        : s,
    );

    this.history = {
      ...this.history,
      present: { ...updated, strokes: strokesWithWidth },
    };
    this.bumpDrawingRevision();

    this.sound?.onStrokeUpdate({
      tool: this.currentTool,
      speed,
      length: this.strokeLength,
      timeSinceStart: now - this.strokeStartTime,
    });
  }

  /** 描画終了（ポインターアップ） */
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
      this.history.present,
    );
    this.strokeStartDrawing = null;
    this.currentStrokeId = null;

    // レンダラーがsetIsDrawingActiveメソッドを持っている場合、描画終了を通知
    if (
      "setIsDrawingActive" in this.renderer &&
      typeof this.renderer.setIsDrawingActive === "function"
    ) {
      this.renderer.setIsDrawingActive(false);
    }

    this.onHistoryChange?.();
  }

  /** undoを実行する */
  undo(): void {
    this.history = undoHistory(this.history);
    // やり直し/進む時はキャッシュをクリア（全ストロークから再生成が必要）
    this.clearRendererCache();
    this.bumpDrawingRevision();
    this.onHistoryChange?.();
  }

  /** redoを実行する */
  redo(): void {
    this.history = redoHistory(this.history);
    // やり直し/進む時はキャッシュをクリア（全ストロークから再生成が必要）
    this.clearRendererCache();
    this.bumpDrawingRevision();
    this.onHistoryChange?.();
  }

  /** 現在の描画データを取得する */
  getDrawing(): Drawing {
    return this.history.present;
  }

  /** 描画の版番号を取得する */
  getDrawingRevision(): number {
    return this.drawingRevision;
  }

  /** 描画を全消去する */
  clear(): void {
    const cleared = clearDrawing(this.history.present);
    this.history = pushHistory(this.history, cleared);
    this.bumpDrawingRevision();
    this.onHistoryChange?.();
  }

  /** ループを停止して後片付けする */
  destroy(): void {
    if (this.loopId !== null) {
      this.raf.cancel(this.loopId);
    }
    this.sound?.destroy?.();
  }

  /**
   * 約45fpsで描画を再レンダリングするループ
   */
  private loop(): void {
    const now = this.time.now();
    const elapsed = now - this.startedAt;

    if (now - this.lastRenderAt >= this.minFrameIntervalMs) {
      renderDrawingAtTime({
        drawing: this.history.present,
        drawingRevision: this.drawingRevision,
        renderer: this.renderer,
        jitterConfig: this.jitterConfig,
        elapsedTimeMs: elapsed,
      });
      this.lastRenderAt = now;
    }

    this.loopId = this.raf.request(this.loop);
  }

  /**
   * ユニークなストロークIDを生成する
   * crypto.randomUUIDが使えない場合はランダム文字列を使用する
   */
  private createStrokeId(): string {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    return `stroke-${Math.random().toString(36).slice(2)}`;
  }

  /** 描画の版番号を進める */
  private bumpDrawingRevision(): void {
    this.drawingRevision += 1;
    invalidatePendingRequests(this.renderer);
  }
}
