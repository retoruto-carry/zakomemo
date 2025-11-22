import type { RafScheduler } from "../engine/ports";

export class BrowserRafScheduler implements RafScheduler {
  request(cb: () => void): number {
    return requestAnimationFrame(cb);
  }
  cancel(id: number): void {
    cancelAnimationFrame(id);
  }
}
