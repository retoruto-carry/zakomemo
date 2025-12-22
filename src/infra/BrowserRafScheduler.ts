import type { RafScheduler } from "../engine/ports";

/**
 * requestAnimationFrameを使用したRafScheduler実装
 */
export class BrowserRafScheduler implements RafScheduler {
  request(cb: () => void): number {
    return requestAnimationFrame(cb);
  }
  cancel(id: number): void {
    cancelAnimationFrame(id);
  }
}
