/**
 * debounce関数
 * 指定された時間が経過してから関数を実行する
 * @param func 実行する関数
 * @param delay 遅延時間（ミリ秒）
 * @returns debounceされた関数
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}
