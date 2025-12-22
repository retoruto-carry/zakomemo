import type { TimeProvider } from "../engine/ports";

/**
 * performance.now()を使用したTimeProvider実装
 */
export class RealTimeProvider implements TimeProvider {
  now(): number {
    return performance.now();
  }
}
