"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/ui/components/LoadingScreen";
import { WigglyEditor } from "@/ui/WigglyEditor";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // フォントとCSSの読み込みを待つ
    const startTime = Date.now();
    const MIN_LOADING_TIME = 2000; // 最小表示時間: 2秒

    const checkReady = () => {
      const loadFonts = document.fonts
        ? document.fonts.ready
        : Promise.resolve();

      loadFonts.then(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);

        setTimeout(() => {
          setIsExiting(true);
        }, remaining);
      });
    };

    if (document.readyState === "complete") {
      checkReady();
    } else {
      window.addEventListener("load", checkReady);
      return () => {
        window.removeEventListener("load", checkReady);
      };
    }
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-white via-sky-50 to-white text-slate-900">
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12 sm:px-10 sm:py-16">
          <WigglyEditor />
        </main>
      </div>
      {isLoading && (
        <LoadingScreen
          isExiting={isExiting}
          onExited={() => setIsLoading(false)}
        />
      )}
    </>
  );
}
