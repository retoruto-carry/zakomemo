"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_DRAWING } from "@/config/presets";
import { assertNever } from "@/core/assertNever";
import type { JitterConfig } from "@/core/jitter";
import type { EraserVariant } from "@/engine/variants";
import type { Tool, WigglyEngine } from "@/engine/WigglyEngine";
import { createWigglyEngine } from "@/infra/createWigglyEngine";

const ERASER_GUIDE = {
  squareRadius: 2,
  line: {
    lengthMult: 2,
  },
} as const;

type PointerInfo = {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
};

type EraserGuideStyle = {
  width: number;
  height: number;
  borderRadius: string;
};

/** 消しゴムガイドの表示スタイルを解決する */
function resolveEraserGuideStyle(params: {
  variant: EraserVariant;
  brushWidth: number;
}): EraserGuideStyle {
  const { variant, brushWidth } = params;
  const size = brushWidth;

  switch (variant) {
    case "eraserCircle":
      return {
        width: size,
        height: size,
        borderRadius: "9999px",
      };
    case "eraserSquare":
      return {
        width: size,
        height: size,
        borderRadius: `${ERASER_GUIDE.squareRadius}px`,
      };
    case "eraserLine":
      return {
        width: brushWidth * ERASER_GUIDE.line.lengthMult,
        height: brushWidth,
        borderRadius: "0px",
      };
    default:
      return assertNever(variant);
  }
}

/** WigglyCanvasの入力プロパティ */
interface WigglyCanvasProps {
  tool: Tool;
  brushWidth: number;
  eraserVariant: EraserVariant;
  paletteColors: string[];
  backgroundColor: string;
  jitterConfig: JitterConfig;
  onEngineInit: (engine: WigglyEngine) => void;
}

/** 描画キャンバス本体 */
export function WigglyCanvas({
  tool,
  brushWidth,
  eraserVariant,
  paletteColors,
  backgroundColor,
  jitterConfig,
  onEngineInit,
}: WigglyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const primaryPointerIdRef = useRef<number | null>(null);
  const activePointersRef = useRef<Map<number, PointerInfo>>(new Map());
  const isMultiTouchRef = useRef(false);
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const eraserGuideStyle = resolveEraserGuideStyle({
    variant: eraserVariant,
    brushWidth,
  });

  // イベントハンドラ内で再バインドせずに現在のツールを参照する
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // エンジンとイベントリスナーを初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: マウント時に1回だけ実行するため
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createWigglyEngine(
      canvas,
      DEFAULT_DRAWING,
      paletteColors,
      backgroundColor,
      jitterConfig,
    );
    onEngineInit(engine);

    // ピンチジェスチャーを許可しつつ、描画のためにパンも制御
    // pan-x pan-y: パンジェスチャーを許可（描画のため）
    // pinch-zoom: ピンチズームを許可（ブラウザのデフォルト動作）
    canvas.style.touchAction = "pan-x pan-y pinch-zoom";

    // 座標変換: client座標→キャンバス論理座標
    /** ポインター座標をキャンバスの論理座標へ変換する */
    const toCanvasPos = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const visualX = ev.clientX - rect.left;
      const visualY = ev.clientY - rect.top;

      // canvas.width/height は DPR を掛けた物理ピクセル値なので、論理サイズに戻してからスケールする
      const dpr = window.devicePixelRatio || 1;
      const logicalWidth = canvas.width / dpr;
      const logicalHeight = canvas.height / dpr;

      const scaleX = logicalWidth / rect.width;
      const scaleY = logicalHeight / rect.height;

      return {
        visual: { x: visualX, y: visualY }, // 画面上の表示座標（eraserガイド用）
        internal: { x: visualX * scaleX, y: visualY * scaleY }, // エンジン用の論理座標
      };
    };

    /** 描画開始のポインター処理 */
    const handlePointerDown = (ev: PointerEvent) => {
      // Apple Pencilの初期pointerdownイベントではpressure=0になることがあるため、
      // pointerdownでは筆圧をチェックせず、すべてのペン入力を処理します。
      // 軽い筆圧でも描画を開始できるようにするためです。

      // マルチタッチ（2本指以上）の検出
      // pointerdownイベントが発火した時点で、既にアクティブなポインターが1本以上ある場合、
      // マルチタッチと判断して描画を無効にし、ピンチジェスチャーを優先します
      const activePointerCount = activePointersRef.current.size;
      if (activePointerCount >= 1) {
        // マルチタッチ状態を記録
        isMultiTouchRef.current = true;
        // 描画を開始せず、ピンチジェスチャーを優先
        // ポインター情報は記録するが、描画は開始しない
        // preventDefaultは呼ばない（ピンチジェスチャーを許可するため）
        const { internal } = toCanvasPos(ev);
        activePointersRef.current.set(ev.pointerId, {
          id: ev.pointerId,
          startX: internal.x,
          startY: internal.y,
          startTime: performance.now(),
          moved: false,
        });
        return;
      }

      // シングルタッチの場合のみ描画を開始
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

    /** 描画中のポインター移動処理 */
    const handlePointerMove = (ev: PointerEvent) => {
      const info = activePointersRef.current.get(ev.pointerId);
      const { visual, internal } = toCanvasPos(ev);

      // ホバー（マウス/ペン）やドラッグ（タッチ/全体）時に消しゴムカーソルを更新
      if (toolRef.current === "eraser") {
        if (
          ev.pointerType === "mouse" ||
          ev.pointerType === "pen" ||
          primaryPointerIdRef.current === ev.pointerId
        ) {
          setEraserPos(visual);
        }
      } else {
        setEraserPos(null);
      }

      // マルチタッチ状態の場合は描画を無効化
      if (isMultiTouchRef.current) {
        return;
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

    /** ポインター終了時の後片付け */
    const cleanupPointer = (
      ev: PointerEvent,
      isCancel: boolean = false,
    ): void => {
      const info = activePointersRef.current.get(ev.pointerId);
      const isPrimaryPointer = ev.pointerId === primaryPointerIdRef.current;

      if (info) {
        activePointersRef.current.delete(ev.pointerId);
      }

      // プライマリーポインターの場合、engine.pointerUp()を呼ぶ
      if (isPrimaryPointer) {
        engine.pointerUp();
        primaryPointerIdRef.current = null;
        if (
          isCancel ||
          toolRef.current !== "eraser" ||
          ev.pointerType === "touch"
        ) {
          setEraserPos(null);
        }
      }

      // すべてのポインターが離れた場合、マルチタッチ状態をリセット
      if (activePointersRef.current.size === 0) {
        isMultiTouchRef.current = false;
        // primaryPointerIdRef.currentは既に上でnullに設定されている可能性があるが、
        // 念のため再度設定（マルチタッチの場合に備えて）
        if (!isPrimaryPointer) {
          primaryPointerIdRef.current = null;
        }
        if (isCancel && !isPrimaryPointer) {
          setEraserPos(null);
        }
      }
      canvas.releasePointerCapture(ev.pointerId);
    };

    /** 描画終了のポインター処理 */
    const handlePointerUp = (ev: PointerEvent) => {
      cleanupPointer(ev, false);
    };

    /** ポインターキャンセル時の処理 */
    const handlePointerCancel = (ev: PointerEvent) => {
      // ポインターがキャンセルされた場合（例: 共有ダイアログが開いた後など）
      // すべての状態をリセット
      cleanupPointer(ev, true);
    };

    // pointercaptureを使うため、move/upはcanvasで処理する
    /** キャンバス外へ出た時のホバー処理 */
    const handlePointerLeave = () => {
      // ドラッグ中でない場合、ペンがキャンバス外に出たら消しゴムを隠す
      if (toolRef.current === "eraser" && !primaryPointerIdRef.current) {
        setEraserPos(null);
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown, {
      passive: false,
    });
    canvas.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);
    canvas.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      engine.destroy();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []); // マウント時に1回だけ実行

  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full touch-none select-none overflow-hidden flex items-center justify-center"
      style={{ backgroundColor }}
    >
      <canvas
        ref={canvasRef}
        width={DEFAULT_DRAWING.width}
        height={DEFAULT_DRAWING.height}
        className="block touch-none"
        style={{
          touchAction: "pan-x pan-y pinch-zoom",
          width: "100%",
          height: "100%",
        }}
      />
      {tool === "eraser" && eraserPos && (
        <div
          className="pointer-events-none absolute border border-black/70 z-10"
          style={{
            width: eraserGuideStyle.width,
            height: eraserGuideStyle.height,
            left: eraserPos.x,
            top: eraserPos.y,
            transform: "translate(-50%, -50%)",
            borderRadius: eraserGuideStyle.borderRadius,
            boxShadow: "0 0 0 1px var(--color-zako-white-90)",
          }}
        />
      )}
    </div>
  );
}
