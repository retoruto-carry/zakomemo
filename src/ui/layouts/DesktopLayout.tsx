"use client";

import type { ReactNode } from "react";

/** DSボタンのイベントハンドラ */
interface DSButtonHandlers {
  onA: () => void;
  onB: () => void;
  onX: () => void;
  onY: () => void;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  onStart: () => void;
  onSelect: () => void;
}

/** レイアウトに渡す表示要素 */
interface LayoutProps {
  canvas: ReactNode;
  tools: ReactNode;
  dsButtons?: DSButtonHandlers;
}

/** デスクトップ向けの本体レイアウト */
export function DesktopLayout({ canvas, tools, dsButtons }: LayoutProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-(--color-zako-dark) p-4 overflow-hidden font-sans text-slate-900">
      {/* テーブル面 */}
      <div
        className="absolute inset-0 bg-(--color-zako-charcoal-soft) opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(var(--color-zako-black) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      {/* Nintendo DSi風の本体 */}
      <div className="relative flex flex-col items-center gap-0 rounded-[3rem] bg-(--zako-body-bg) shadow-[0_50px_100px_var(--color-zako-black-80),inset_0_-4px_10px_var(--color-zako-black-05),0_0_0_1px_var(--color-zako-black-10)] w-[650px] shrink-0 overflow-hidden border-b-[6px] border-(--zako-body-border)">
        {/* 上部シェル */}
        <div className="w-full bg-(--zako-body-bg) p-4 pt-6 pb-6 flex flex-col items-center relative">
          {/* スピーカー穴（左） */}
          <div className="absolute left-[8%] top-[40%] flex flex-col items-center justify-center gap-1.5 opacity-40">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
          </div>

          {/* 上画面 */}
          <div className="relative w-full max-w-[420px] aspect-3/2 bg-(--zako-bezel-bg) rounded-sm p-2 shadow-[inset_0_1px_8px_var(--color-zako-black-80)] border-[2px] border-(--zako-bezel-border)">
            {/* 光沢スクリーン */}
            <div className="relative w-full h-full bg-white shadow-[0_0_40px_var(--color-zako-white-05)] overflow-hidden rounded-[2px]">
              {canvas}
            </div>
          </div>

          {/* スピーカー穴（右） */}
          <div className="absolute right-[8%] top-[40%] flex flex-col items-center justify-center gap-1.5 opacity-40">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-black/40 shadow-inner" />
            </div>
          </div>
        </div>

        {/* ヒンジ部分 */}
        <div className="w-full h-10 bg-linear-to-b from-(--zako-hinge-from) via-(--zako-hinge-via) to-(--zako-hinge-to) relative flex items-center justify-center border-y border-(--zako-hinge-border) z-20">
          {/* ステータスLED（ヒンジ左側）- 装飾のみ */}
          <div className="absolute left-[12%] top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full border border-white/20">
            <div
              aria-hidden="true"
              className="w-1.5 h-3 rounded-full bg-(--color-zako-led-blue) shadow-[0_0_5px_var(--color-zako-led-blue-glow)]"
              title="Wireless"
            />
            <div
              aria-hidden="true"
              className="w-1.5 h-3 rounded-full bg-(--color-zako-led-amber) opacity-20"
              title="Charge"
            />
            <div
              aria-hidden="true"
              className="w-1.5 h-3 rounded-full bg-(--color-zako-led-green) shadow-[0_0_5px_var(--color-zako-led-green-glow)]"
              title="Power"
            />
          </div>

          {/* 内蔵カメラ */}
          <div className="w-6 h-6 rounded-full bg-(--color-zako-ink) border-[2px] border-(--zako-hinge-border) shadow-[inset_0_2px_4px_var(--color-zako-black-80)] flex items-center justify-center relative">
            <div className="w-2 h-2 rounded-full bg-linear-to-tr from-(--color-zako-lens-from) to-(--color-zako-lens-to)" />
            {/* マイク穴（カメラ右隣に配置） */}
            <div className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-(--color-zako-gray-600) shadow-inner" />
          </div>
        </div>

        {/* 下部シェル */}
        <div className="w-full bg-(--zako-body-bg) p-4 pt-4 pb-6 flex items-center justify-center gap-2 relative border-t border-white/50">
          {/* 左: 十字キーと電源 */}
          <div className="flex flex-col items-end gap-6 -mt-2">
            <div className="relative w-[88px] h-[88px] flex items-center justify-center">
              {/* 十字キー台座（本体色に合わせ、影なし） */}
              <div className="absolute w-[110%] h-[110%] rounded-full bg-(--zako-body-bg)" />

              {/* 十字キーの十字（clip-pathで一体形状にして影を調整） */}
              <div
                className="relative w-[85%] h-[85%]"
                style={{
                  filter:
                    "drop-shadow(1px 0 0 var(--zako-body-border)) drop-shadow(-1px 0 0 var(--zako-body-border)) drop-shadow(0 1px 0 var(--zako-body-border)) drop-shadow(0 -1px 0 var(--zako-body-border)) drop-shadow(0 2px 4px var(--color-zako-black-10))",
                }}
              >
                <div
                  className="w-full h-full bg-(--zako-button-bg)"
                  style={{
                    clipPath:
                      "polygon(34% 0%, 66% 0%, 66% 34%, 100% 34%, 100% 66%, 66% 66%, 66% 100%, 34% 100%, 34% 66%, 0% 66%, 0% 34%, 34% 34%)",
                  }}
                />

                {/* 十字キーの装飾 */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* 方向マーク */}
                  <div className="absolute top-2 w-0 h-0 border-l-4 border-r-4 border-b-6 border-l-transparent border-r-transparent border-b-(--color-zako-gray-500) opacity-60" />
                  <div className="absolute bottom-2 w-0 h-0 border-l-4 border-r-4 border-t-6 border-l-transparent border-r-transparent border-t-(--color-zako-gray-500) opacity-60" />
                  <div className="absolute left-2 w-0 h-0 border-t-4 border-b-4 border-r-6 border-t-transparent border-b-transparent border-r-(--color-zako-gray-500) opacity-60" />
                  <div className="absolute right-2 w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent border-l-(--color-zako-gray-500) opacity-60" />
                </div>

                {/* 十字キーのクリック領域 */}
                <button
                  type="button"
                  onClick={dsButtons?.onUp}
                  className="absolute top-0 left-[34%] w-[32%] h-[34%] active:bg-black/5 rounded-t-sm cursor-pointer hover:bg-black/5 transition-colors z-10"
                  aria-label="上"
                />
                <button
                  type="button"
                  onClick={dsButtons?.onDown}
                  className="absolute bottom-0 left-[34%] w-[32%] h-[34%] active:bg-black/5 rounded-b-sm cursor-pointer hover:bg-black/5 transition-colors z-10"
                  aria-label="下"
                />
                <button
                  type="button"
                  onClick={dsButtons?.onLeft}
                  className="absolute top-[34%] left-0 w-[34%] h-[32%] active:bg-black/5 rounded-l-sm cursor-pointer hover:bg-black/5 transition-colors z-10"
                  aria-label="左"
                />
                <button
                  type="button"
                  onClick={dsButtons?.onRight}
                  className="absolute top-[34%] right-0 w-[34%] h-[32%] active:bg-black/5 rounded-r-sm cursor-pointer hover:bg-black/5 transition-colors z-10"
                  aria-label="右"
                />
              </div>
            </div>

            {/* 電源ボタン（装飾） */}
            <div className="flex items-center gap-1.5 -mt-1 pr-1">
              <span className="text-[7px] font-black text-(--color-zako-gray-400) tracking-[0.1em]">
                POWER
              </span>
              <div
                aria-hidden="true"
                className="w-5 h-5 rounded-full bg-(--zako-button-bg) border border-(--zako-button-border) shadow-[0_1px_3px_var(--color-zako-black-10),inset_0_1px_2px_var(--color-zako-panel)] active:scale-90 flex items-center justify-center"
              >
                <div className="w-2 h-2 rounded-full border border-(--color-zako-gray-500) relative">
                  <div className="absolute top-[-1.5px] left-1/2 -translate-x-1/2 w-0.5 h-0.5 bg-(--color-zako-gray-500)" />
                </div>
              </div>
            </div>
          </div>

          {/* 中央: 下画面 */}
          <div className="shrink-0 relative w-full max-w-[420px] bg-(--zako-bezel-bg) rounded-sm p-2 shadow-[inset_0_1px_8px_var(--color-zako-black-80)] border-[2px] border-(--zako-bezel-border)">
            <div className="relative w-full h-full bg-(--color-zako-paper) shadow-[inset_0_2px_10px_var(--color-zako-black-10)] overflow-hidden rounded-[2px]">
              {tools}
            </div>
          </div>

          {/* 右: A/B/X/Y と Start/Select */}
          <div className="flex flex-col items-start gap-6 -mt-2">
            <div className="relative w-[88px] h-[88px] flex items-center justify-center">
              {/* ボタン台座（本体色に合わせ、影なし） */}
              <div className="absolute w-[110%] h-[110%] rounded-full bg-(--zako-body-bg)" />

              {/* ダイヤ配置のボタン */}
              <div className="relative w-full h-full grid grid-cols-3 grid-rows-3 p-1">
                <button
                  type="button"
                  onClick={dsButtons?.onX}
                  className="col-start-2 row-start-1 w-8 h-8 rounded-full bg-(--zako-button-bg) border border-(--zako-button-border) shadow-[0_2px_4px_var(--color-zako-black-10)] active:translate-y-px flex items-center justify-center font-bold text-xs text-(--zako-button-text) cursor-pointer hover:brightness-110 transition-all"
                  aria-label="X"
                >
                  X
                </button>
                <button
                  type="button"
                  onClick={dsButtons?.onY}
                  className="col-start-1 row-start-2 w-8 h-8 rounded-full bg-(--zako-button-bg) border border-(--zako-button-border) shadow-[0_2px_4px_var(--color-zako-black-10)] active:translate-y-px flex items-center justify-center font-bold text-xs text-(--zako-button-text) cursor-pointer hover:brightness-110 transition-all"
                  aria-label="Y"
                >
                  Y
                </button>
                <button
                  type="button"
                  onClick={dsButtons?.onA}
                  className="col-start-3 row-start-2 w-8 h-8 rounded-full bg-(--zako-button-bg) border border-(--zako-button-border) shadow-[0_2px_4px_var(--color-zako-black-10)] active:translate-y-px flex items-center justify-center font-bold text-xs text-(--zako-button-text) cursor-pointer hover:brightness-110 transition-all"
                  aria-label="A"
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={dsButtons?.onB}
                  className="col-start-2 row-start-3 w-8 h-8 rounded-full bg-(--zako-button-bg) border border-(--zako-button-border) shadow-[0_2px_4px_var(--color-zako-black-10)] active:translate-y-px flex items-center justify-center font-bold text-xs text-(--zako-button-text) cursor-pointer hover:brightness-110 transition-all"
                  aria-label="B"
                >
                  B
                </button>
              </div>
            </div>

            {/* START/SELECT（スタート/セレクト） */}
            <div className="flex flex-col gap-2 pl-1 -mt-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={dsButtons?.onStart}
                  className="w-3.5 h-3.5 rounded-full bg-(--zako-button-bg) border border-(--zako-button-border) shadow-[0_2px_4px_var(--color-zako-black-10)] active:scale-90 cursor-pointer hover:brightness-110 transition-all"
                  aria-label="START"
                />
                <span className="text-[6px] font-black text-(--color-zako-gray-300) tracking-tighter">
                  START
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={dsButtons?.onSelect}
                  className="w-3.5 h-3.5 rounded-full bg-(--zako-button-bg) border border-(--zako-button-border) shadow-[0_2px_4px_var(--color-zako-black-10)] active:scale-90 cursor-pointer hover:brightness-110 transition-all"
                  aria-label="SELECT"
                />
                <span className="text-[6px] font-black text-(--color-zako-gray-300) tracking-tighter">
                  SELECT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
