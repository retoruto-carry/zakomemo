import type { TimeProvider } from "../engine/ports";

export class RealTimeProvider implements TimeProvider {
  now(): number {
    return performance.now();
  }
}
