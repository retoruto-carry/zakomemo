"use client";

import styles from "./LoadingScreen.module.css";
import { useEffect, useState } from "react";

interface LoadingScreenProps {
  isExiting?: boolean;
  onExited?: () => void;
}

export function LoadingScreen({ isExiting, onExited }: LoadingScreenProps) {
  useEffect(() => {
    if (isExiting && onExited) {
      // Animation duration + delay (0.8s + 0.1s = 0.9s)
      const timer = setTimeout(onExited, 900);
      return () => clearTimeout(timer);
    }
  }, [isExiting, onExited]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ${
        isExiting ? styles.exit : ""
      }`}
    >
      {/* Background Layers */}
      <div className={`${styles.layer} ${styles.layer2}`} />
      <div className={`${styles.layer} ${styles.layer1}`} />

      {/* Content */}
      <div
        className={`relative z-30 flex flex-col items-center gap-4 ${styles.content}`}
      >
        {/* biome-ignore lint/performance/noImgElement: ローディング画面でのfavicon表示のため */}
        <img
          src="/favicon.ico"
          alt="Loading"
          className="w-12 h-12 animate-pulse"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
