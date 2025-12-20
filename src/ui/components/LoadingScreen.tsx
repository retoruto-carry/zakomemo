"use client";

import { useEffect } from "react";
import styles from "./LoadingScreen.module.css";

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
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ${isExiting ? styles.exit : ""
        }`}
    >
      {/* Background Layers */}
      <div className={`${styles.layer} ${styles.layer2}`} />
      <div className={`${styles.layer} ${styles.layer1}`} />

      {/* Content */}
      <div
        className={`relative z-30 flex flex-col items-center gap-4 ${styles.content}`}
      >
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
