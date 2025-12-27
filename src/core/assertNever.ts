/**
 * never型の到達を検出するためのユーティリティ
 * 想定外の分岐が起きた場合に例外を投げる
 * @param value 予期しない値
 * @param message 任意の補足メッセージ
 */
export function assertNever(value: never, message?: string): never {
  const suffix = message ? ` (${message})` : "";
  throw new Error(`Unexpected value: ${String(value)}${suffix}`);
}
