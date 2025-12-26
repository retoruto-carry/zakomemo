import type { RafScheduler } from "@/engine/ports";

/**
 * requestAnimationFrameを使用したRafScheduler実装
 */
export class BrowserRafScheduler implements RafScheduler {
  /** アニメーションフレームを登録する */
  request(cb: () => void): number {
    return requestAnimationFrame(cb);
  }
  /** 登録済みのフレームをキャンセルする */
  cancel(id: number): void {
    cancelAnimationFrame(id);
  }
}
