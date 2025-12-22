/**
 * ピクセルアート用のユーティリティ関数
 * 座標の整数化、Bresenhamアルゴリズム、ブラシサイズの整数化を提供
 */

/**
 * 座標を最も近い整数ピクセルにスナップ
 * @param x X座標
 * @param y Y座標
 * @returns スナップされた座標
 */
export function snapToPixel(x: number, y: number): { x: number; y: number } {
  // NaN/Infinityの場合は0にフォールバック（防御的プログラミング）
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

/**
 * ブラシサイズを整数にスナップ
 * 最小値は1
 * @param width ブラシサイズ
 * @returns スナップされたブラシサイズ
 */
export function snapBrushWidth(width: number): number {
  // NaN/Infinityの場合は1にフォールバック（防御的プログラミング）
  if (!Number.isFinite(width)) {
    return 1;
  }
  return Math.max(1, Math.round(width));
}

/**
 * Bresenhamアルゴリズムで2点間をピクセル単位で結ぶ
 * 8方向（水平、垂直、4方向の斜め）に対応
 * @param x0 始点X座標
 * @param y0 始点Y座標
 * @param x1 終点X座標
 * @param y1 終点Y座標
 * @returns ピクセル座標の配列
 */
export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  // 座標を整数に変換
  const x0Int = Math.round(x0);
  const y0Int = Math.round(y0);
  const x1Int = Math.round(x1);
  const y1Int = Math.round(y1);

  // 同じ点の場合は1点のみ返す
  if (x0Int === x1Int && y0Int === y1Int) {
    return [{ x: x0Int, y: y0Int }];
  }

  const dx = Math.abs(x1Int - x0Int);
  const dy = Math.abs(y1Int - y0Int);
  const sx = x0Int < x1Int ? 1 : -1;
  const sy = y0Int < y1Int ? 1 : -1;

  let x = x0Int;
  let y = y0Int;
  let err = dx - dy;

  // 最初の点を追加
  points.push({ x, y });

  while (x !== x1Int || y !== y1Int) {
    const e2 = 2 * err;

    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }

    if (e2 < dx) {
      err += dx;
      y += sy;
    }

    points.push({ x, y });
  }

  return points;
}
