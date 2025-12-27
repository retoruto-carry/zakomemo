import type { TimeProvider } from "@/engine/ports";

/**
 * performance.now()を使用したTimeProvider実装
 */
export class RealTimeProvider implements TimeProvider {
  /** 現在時刻（高精度）を返す */
  now(): number {
    return performance.now();
  }
}
