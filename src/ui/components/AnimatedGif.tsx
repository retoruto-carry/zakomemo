"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/** AnimatedGifの入力 */
interface AnimatedGifProps {
  /** 定常状態で表示するPNG画像のパス */
  staticSrc: string;
  /** アニメーション時に表示するGIF画像のパス（ループ1） */
  animatedSrc: string;
  alt?: string;
  className?: string;
  /** アニメーションの再生時間（ミリ秒）。デフォルトは2000ms */
  animationDuration?: number;
}

/** AnimatedGifの外部操作用ハンドル */
export interface AnimatedGifHandle {
  playAnimation: () => void;
}

/**
 * GIFアニメーションを表示するコンポーネント
 * 外部からアニメーションをトリガーできる
 * 定常状態はPNG、アニメーション時はループ1のGIFを表示
 */
export const AnimatedGif = forwardRef<AnimatedGifHandle, AnimatedGifProps>(
  (
    {
      staticSrc,
      animatedSrc,
      alt = "",
      className = "",
      animationDuration = 2000,
    },
    ref,
  ) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [currentSrc, setCurrentSrc] = useState(staticSrc);
    const [isAnimating, setIsAnimating] = useState(false);

    // アニメーション完了後にPNGに戻す
    useEffect(() => {
      if (!isAnimating) return;

      const timer = setTimeout(() => {
        setCurrentSrc(staticSrc);
        setIsAnimating(false);
      }, animationDuration);

      return () => {
        clearTimeout(timer);
      };
    }, [isAnimating, staticSrc, animationDuration]);

    const playAnimation = () => {
      if (!isAnimating) {
        setIsAnimating(true);
        setCurrentSrc(animatedSrc);
      }
    };

    useImperativeHandle(ref, () => ({
      playAnimation,
    }));

    return (
      <>
        {/* biome-ignore lint/performance/noImgElement: GIFアニメーション表示のため */}
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          className={className}
          aria-hidden={alt === ""}
          onError={() => {
            if (currentSrc === animatedSrc) {
              setCurrentSrc(staticSrc);
              setIsAnimating(false);
            }
          }}
        />
      </>
    );
  },
);

AnimatedGif.displayName = "AnimatedGif";
