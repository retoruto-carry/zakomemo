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

/**
 * 半径ごとの円オフセットテーブル（キャッシュ）
 * キー: 半径、値: その半径の円内のオフセット配列
 */
const circleOffsetCache = new Map<number, Array<{ dx: number; dy: number }>>();

/**
 * 指定半径の円内のオフセットを取得（テーブル化）
 * パフォーマンス最適化: 半径ごとにオフセットを事前計算してキャッシュ
 * @param radius 半径
 * @returns 円内のオフセット配列 [{dx, dy}, ...]
 */
function getCircleOffsets(radius: number): Array<{ dx: number; dy: number }> {
  if (radius <= 0) {
    return [{ dx: 0, dy: 0 }];
  }

  // キャッシュをチェック
  const cached = circleOffsetCache.get(radius);
  if (cached) {
    return cached;
  }

  // テーブルを生成
  const offsets: Array<{ dx: number; dy: number }> = [];
  const radiusSq = radius * radius;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dSq = dx * dx + dy * dy;
      if (dSq <= radiusSq) {
        offsets.push({ dx, dy });
      }
    }
  }

  // キャッシュに保存
  circleOffsetCache.set(radius, offsets);
  return offsets;
}

/**
 * スキャンライン方式で太い線の領域を計算
 * パフォーマンス最適化: 各y行ごとのxMin/xMaxを計算してから塗る
 * これにより、太さが増えても計算量が面積に比例する
 * @param centerPixels 中心線上のピクセル座標の配列
 * @param width 線の太さ
 * @returns 塗りつぶすべきピクセル座標の配列（重複排除済み）
 */
export function calculateThickLinePixels(
  centerPixels: Array<{ x: number; y: number }>,
  width: number,
): Array<{ x: number; y: number }> {
  if (width <= 1) {
    return centerPixels;
  }

  if (centerPixels.length === 0) {
    return [];
  }

  const radius = Math.floor(width / 2);
  if (radius <= 0) {
    return centerPixels;
  }

  // bounding boxを計算
  let minX = centerPixels[0].x;
  let maxX = centerPixels[0].x;
  let minY = centerPixels[0].y;
  let maxY = centerPixels[0].y;

  for (const p of centerPixels) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  // 半径分のマージンを追加
  minX -= radius;
  maxX += radius;
  minY -= radius;
  maxY += radius;

  const height = maxY - minY + 1;
  if (height <= 0) {
    return [];
  }

  // y行ごとのxMin/xMaxを初期化
  const xMin = new Int16Array(height).fill(32767); // +INFの代わり
  const xMax = new Int16Array(height).fill(-32768); // -INFの代わり

  // 円の断面幅テーブル（dy → dx）を事前計算
  const circleDX: number[] = [];
  const radiusSq = radius * radius;
  for (let dy = 0; dy <= radius; dy++) {
    const dx = Math.floor(Math.sqrt(radiusSq - dy * dy));
    circleDX[dy] = dx;
  }

  // 中心線を走査して、各点の円が寄与する範囲を更新
  for (const center of centerPixels) {
    const cx = center.x;
    const cy = center.y;

    for (let dy = -radius; dy <= radius; dy++) {
      const y = cy + dy;
      if (y < minY || y > maxY) continue;

      const row = y - minY;
      const absDy = Math.abs(dy);
      const dx = circleDX[absDy] ?? 0;

      xMin[row] = Math.min(xMin[row], cx - dx);
      xMax[row] = Math.max(xMax[row], cx + dx);
    }
  }

  // スキャンラインで塗るピクセルを集める
  const pixels = new Map<number, Set<number>>(); // x -> Set<y>

  for (let row = 0; row < height; row++) {
    if (xMin[row] > xMax[row]) continue; // この行は塗らない

    const y = minY + row;
    for (let x = xMin[row]; x <= xMax[row]; x++) {
      if (!pixels.has(x)) pixels.set(x, new Set());
      pixels.get(x)?.add(y);
    }
  }

  // Mapから配列に変換
  const result: Array<{ x: number; y: number }> = [];
  pixels.forEach((ys, x) => {
    ys.forEach((y) => {
      result.push({ x, y });
    });
  });

  return result;
}

/**
 * 円を描画するためのオフセット配列を取得（テーブル化）
 * パフォーマンス最適化: 半径ごとにオフセットを事前計算
 * @param radius 半径
 * @returns 円内のオフセット配列 [{dx, dy}, ...]
 */
export function getCirclePixelOffsets(
  radius: number,
): Array<{ dx: number; dy: number }> {
  return getCircleOffsets(radius);
}
