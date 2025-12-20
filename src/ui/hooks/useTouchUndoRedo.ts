"use client";

import { useEffect, useRef } from "react";

/** 連続タップ防止のための最小間隔（ミリ秒） */
const MIN_TAP_INTERVAL = 500;
/** タップ後のクールダウン時間（ミリ秒） */
const TAP_COOLDOWN = 300;

interface TouchInfo {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastY: number;
  totalDistance: number;
}

interface UseTouchUndoRedoOptions {
  onUndo: () => void;
  onRedo: () => void;
  /** タップと判定する最大時間（ミリ秒）。デフォルト: 300ms */
  maxTapDuration?: number;
  /** タップと判定する最大移動距離（ピクセル）。デフォルト: 10px */
  maxTapDistance?: number;
  /** ピンチと判定する最小移動距離（ピクセル）。デフォルト: 20px */
  minPinchDistance?: number;
  /** ピンチと判定する最小接触時間（ミリ秒）。デフォルト: 100ms */
  minPinchDuration?: number;
  /** 有効にするかどうか。デフォルト: true */
  enabled?: boolean;
}

/**
 * タッチスクリーンでのundo/redoを処理するカスタムフック
 * - 二本指タップ: undo
 * - 三本指タップ: redo
 * - ピンチインアウトと区別するため、接触時間と移動距離を考慮
 */
export function useTouchUndoRedo({
  onUndo,
  onRedo,
  maxTapDuration = 300,
  maxTapDistance = 10,
  minPinchDistance = 20,
  minPinchDuration = 100,
  enabled = true,
}: UseTouchUndoRedoOptions) {
  const touchesRef = useRef<Map<number, TouchInfo>>(new Map());
  const lastTapTimeRef = useRef<number>(0);
  const tapCooldownRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (ev: TouchEvent) => {
      // 既存のタッチをクリア（新しいタッチセッション）
      if (ev.touches.length === 1) {
        touchesRef.current.clear();
      }

      // changedTouchesを使用して、新しく追加されたタッチのみを処理
      for (let i = 0; i < ev.changedTouches.length; i += 1) {
        const touch = ev.changedTouches[i];
        const now = performance.now();

        touchesRef.current.set(touch.identifier, {
          id: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
          startTime: now,
          lastX: touch.clientX,
          lastY: touch.clientY,
          totalDistance: 0,
        });
      }
    };

    const handleTouchMove = (ev: TouchEvent) => {
      // changedTouchesを使用して、移動したタッチのみを処理
      for (let i = 0; i < ev.changedTouches.length; i += 1) {
        const touch = ev.changedTouches[i];
        const info = touchesRef.current.get(touch.identifier);

        if (info) {
          const dx = touch.clientX - info.lastX;
          const dy = touch.clientY - info.lastY;
          const distance = Math.hypot(dx, dy);
          info.totalDistance += distance;
          info.lastX = touch.clientX;
          info.lastY = touch.clientY;
        }
      }
    };

    const handleTouchEnd = (ev: TouchEvent) => {
      const now = performance.now();

      // クールダウン中は処理しない
      if (now < tapCooldownRef.current) {
        touchesRef.current.clear();
        return;
      }

      // すべてのタッチが終了したか確認
      const activeTouches = Array.from(touchesRef.current.values());
      const activeTouchIds = new Set(
        Array.from(ev.touches, (t) => t.identifier),
      );
      const endedTouches = activeTouches.filter(
        (info) => !activeTouchIds.has(info.id),
      );

      // すべてのタッチが終了した場合のみ処理
      if (ev.touches.length === 0 && endedTouches.length > 0) {
        const touchCount = endedTouches.length;

        // ピンチインアウトの判定
        const maxDistance = Math.max(
          ...endedTouches.map((t) => t.totalDistance),
        );
        const minDuration = Math.min(
          ...endedTouches.map((t) => now - t.startTime),
        );
        const maxDistanceFromStart = Math.max(
          ...endedTouches.map((t) =>
            Math.hypot(t.lastX - t.startX, t.lastY - t.startY),
          ),
        );

        const isPinch =
          maxDistance >= minPinchDistance ||
          (minDuration >= minPinchDuration &&
            maxDistanceFromStart >= minPinchDistance);

        // ピンチでない場合のみundo/redoを実行
        if (!isPinch) {
          // すべてのタッチがタップ条件を満たしているか確認
          const allTaps = endedTouches.every((t) => {
            const duration = now - t.startTime;
            const distance = Math.hypot(t.lastX - t.startX, t.lastY - t.startY);
            return duration < maxTapDuration && distance < maxTapDistance;
          });

          if (allTaps) {
            // 連続タップの防止（前回のタップから一定時間以内は無視）
            if (now - lastTapTimeRef.current < MIN_TAP_INTERVAL) {
              touchesRef.current.clear();
              return;
            }

            lastTapTimeRef.current = now;
            tapCooldownRef.current = now + TAP_COOLDOWN;

            if (touchCount === 2) {
              // 二本指タップ: undo
              onUndo();
            } else if (touchCount === 3) {
              // 三本指タップ: redo
              onRedo();
            }
          }
        }
        // ジェスチャーの評価が完了したので、次のジェスチャーのためにタッチ情報をクリア
        touchesRef.current.clear();
      } else {
        // 終了したタッチを削除（まだ他のタッチが残っている場合）
        endedTouches.forEach((t) => {
          touchesRef.current.delete(t.id);
        });
      }
    };

    const handleTouchCancel = () => {
      touchesRef.current.clear();
    };

    // 画面全体にイベントリスナーを追加
    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, {
      passive: true,
    });
    document.addEventListener("touchend", handleTouchEnd, {
      passive: true,
    });
    document.addEventListener("touchcancel", handleTouchCancel, {
      passive: true,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [
    onUndo,
    onRedo,
    maxTapDuration,
    maxTapDistance,
    minPinchDistance,
    minPinchDuration,
    enabled,
  ]);
}
