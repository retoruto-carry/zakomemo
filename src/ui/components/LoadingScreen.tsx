"use client";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
      {/* Background Layer */}
      <div className="absolute inset-0 bg-[#ff6000]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4">
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
