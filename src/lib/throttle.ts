/**
 * throttle関数
 * 指定された時間間隔で関数の実行を制限する
 * @param func 実行する関数
 * @param delay 遅延時間（ミリ秒）
 * @returns throttleされた関数
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func(...args);
    } else {
      // 次の実行をスケジュール
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - timeSinceLastCall);
    }
  };
}
