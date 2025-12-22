"use client";

import { useEffect, useRef } from "react";

// ジェスチャー検出の閾値定数
const DEFAULT_MAX_TAP_DISTANCE_PX = 15;
const DEFAULT_MIN_PINCH_DISTANCE_PX = 30;
const DEFAULT_MIN_PINCH_DURATION_MS = 150;

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
  /** タップと判定する最大移動距離（ピクセル）。デフォルト: 15px */
  maxTapDistance?: number;
  /** ピンチと判定する最小移動距離（ピクセル）。デフォルト: 30px */
  minPinchDistance?: number;
  /** ピンチと判定する最小接触時間（ミリ秒）。デフォルト: 150ms */
  minPinchDuration?: number;
  /** 有効にするかどうか。デフォルト: true */
  enabled?: boolean;
  /** イベントリスナーを追加する要素。デフォルト: document */
  target?: HTMLElement | null;
}

/**
 * タッチスクリーンでのundo/redoを処理するカスタムフック
 * - 二本指タップ: undo
 * - 三本指タップ: redo
 * - ピンチインアウトと区別するため、接触時間と移動距離を考慮
 *
 * iOS/Androidの標準的なジェスチャー検出に基づいて実装
 */
export function useTouchUndoRedo({
  onUndo,
  onRedo,
  maxTapDuration = 300,
  maxTapDistance = DEFAULT_MAX_TAP_DISTANCE_PX,
  minPinchDistance = DEFAULT_MIN_PINCH_DISTANCE_PX,
  minPinchDuration = DEFAULT_MIN_PINCH_DURATION_MS,
  enabled = true,
  target = null,
}: UseTouchUndoRedoOptions) {
  const touchesRef = useRef<Map<number, TouchInfo>>(new Map());
  const targetRef = useRef<HTMLElement | Document | null>(null);
  // コールバックをrefで保持して、setTimeout内でも最新のコールバックを呼び出す
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);

  // コールバックのrefを更新
  useEffect(() => {
    onUndoRef.current = onUndo;
    onRedoRef.current = onRedo;
  }, [onUndo, onRedo]);

  useEffect(() => {
    if (!enabled) return;

    // ターゲット要素を決定（nullの場合はdocument）
    targetRef.current = target || document;

    const handleTouchStart = (ev: TouchEvent) => {
      // 新しいジェスチャーが開始された場合（すべてのタッチが終了した後）のみクリア
      // これにより、2本指や3本指で同時にタップした場合でも、すべてのタッチ情報が保持される
      if (ev.touches.length === ev.changedTouches.length) {
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

      // すべてのタッチが終了した場合のみ処理
      // 指を順番に離した場合でも、すべての指の情報を保持するため、
      // すべての指が離れるまでtouchesRefから情報を削除しない
      if (ev.touches.length === 0) {
        // タッチ情報が空の場合は早期リターン
        if (touchesRef.current.size === 0) {
          return;
        }

        const activeTouches = Array.from(touchesRef.current.values());
        const touchCount = activeTouches.length;

        // 2本指または3本指の場合のみundo/redoを処理
        if (touchCount === 2 || touchCount === 3) {
          // 各タッチの移動距離と時間を計算
          const maxTotalDistance = Math.max(
            ...activeTouches.map((t) => t.totalDistance),
          );
          const minDuration = Math.min(
            ...activeTouches.map((t) => now - t.startTime),
          );
          const maxDistanceFromStart = Math.max(
            ...activeTouches.map((t) =>
              Math.hypot(t.lastX - t.startX, t.lastY - t.startY),
            ),
          );

          // ピンチジェスチャーの判定
          // 1. 累積移動距離が閾値を超えている
          // 2. または、接触時間が長く、開始位置からの距離が閾値を超えている
          const isPinch =
            maxTotalDistance >= minPinchDistance ||
            (minDuration >= minPinchDuration &&
              maxDistanceFromStart >= minPinchDistance);

          // ピンチでない場合のみundo/redoを実行
          if (!isPinch) {
            // すべてのタッチがタップ条件を満たしているか確認
            const allTaps = activeTouches.every((t) => {
              const duration = now - t.startTime;
              const distanceFromStart = Math.hypot(
                t.lastX - t.startX,
                t.lastY - t.startY,
              );
              return (
                duration < maxTapDuration &&
                distanceFromStart < maxTapDistance &&
                t.totalDistance < maxTapDistance * 2
              );
            });

            if (allTaps) {
              // 短いディレイを追加して、他のジェスチャーとの競合を避ける
              // refを使用して最新のコールバックを確実に呼び出す
              setTimeout(() => {
                if (touchCount === 2) {
                  // 二本指タップ: undo
                  onUndoRef.current();
                } else if (touchCount === 3) {
                  // 三本指タップ: redo
                  onRedoRef.current();
                }
              }, 0);
            }
          }
        }
        // ジェスチャーの評価が完了したので、次のジェスチャーのためにタッチ情報をクリア
        touchesRef.current.clear();
      } else {
        // まだタッチが残っている場合、終了したタッチのみを削除
        // 指を順番に離した場合でも、すべての指が離れるまでタッチ情報を保持するため、
        // 終了したタッチのみを削除し、残りのタッチ情報は保持する
        // これにより、2本指や3本指で順次離した場合でも正しく検出できる
        for (let i = 0; i < ev.changedTouches.length; i += 1) {
          const touch = ev.changedTouches[i];
          touchesRef.current.delete(touch.identifier);
        }
      }
    };

    const handleTouchCancel = () => {
      touchesRef.current.clear();
    };

    const element = targetRef.current;
    const options = { passive: true };

    // イベントリスナーを追加
    element.addEventListener(
      "touchstart",
      handleTouchStart as EventListener,
      options,
    );
    element.addEventListener(
      "touchmove",
      handleTouchMove as EventListener,
      options,
    );
    element.addEventListener(
      "touchend",
      handleTouchEnd as EventListener,
      options,
    );
    element.addEventListener(
      "touchcancel",
      handleTouchCancel as EventListener,
      options,
    );

    return () => {
      element.removeEventListener(
        "touchstart",
        handleTouchStart as EventListener,
      );
      element.removeEventListener(
        "touchmove",
        handleTouchMove as EventListener,
      );
      element.removeEventListener("touchend", handleTouchEnd as EventListener);
      element.removeEventListener(
        "touchcancel",
        handleTouchCancel as EventListener,
      );
    };
  }, [
    maxTapDuration,
    maxTapDistance,
    minPinchDistance,
    minPinchDuration,
    enabled,
    target,
  ]);
}
