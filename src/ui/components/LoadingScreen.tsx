"use client";

import { useEffect, useRef } from "react";
import styles from "./LoadingScreen.module.css";

/** LoadingScreenの入力 */
interface LoadingScreenProps {
  isExiting?: boolean;
  onExited?: () => void;
}

/** ローディング画面 */
export function LoadingScreen({ isExiting, onExited }: LoadingScreenProps) {
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const hasCalledOnExitedRef = useRef(false);

  useEffect(() => {
    if (!isExiting || !onExited) return;

    /** アニメーション終了時にコールバックを呼ぶ */
    const handleAnimationEnd = () => {
      if (!hasCalledOnExitedRef.current) {
        hasCalledOnExitedRef.current = true;
        onExited();
      }
    };

    const layer1 = layer1Ref.current;
    const layer2 = layer2Ref.current;

    // 最後のアニメーション（layer2）が終了したらonExitedを呼ぶ
    if (layer2) {
      layer2.addEventListener("animationend", handleAnimationEnd, {
        once: true,
      });
    } else if (layer1) {
      // layer2がない場合はlayer1の終了を待つ
      layer1.addEventListener("animationend", handleAnimationEnd, {
        once: true,
      });
    }

    return () => {
      if (layer1) {
        layer1.removeEventListener("animationend", handleAnimationEnd);
      }
      if (layer2) {
        layer2.removeEventListener("animationend", handleAnimationEnd);
      }
    };
  }, [isExiting, onExited]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ${
        isExiting ? styles.exit : ""
      }`}
    >
      {/* 背景レイヤー */}
      <div ref={layer2Ref} className={`${styles.layer} ${styles.layer2}`} />
      <div ref={layer1Ref} className={`${styles.layer} ${styles.layer1}`} />

      {/* コンテンツ */}
      <div
        className={`relative z-30 flex flex-col items-center gap-4 ${styles.content}`}
      >
        {/* biome-ignore lint/performance/noImgElement: ローディング画面のGIFアニメーション表示のため */}
        <img
          src="/images/frog_fast.gif"
          alt="Loading"
          className="w-24 h-24"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
