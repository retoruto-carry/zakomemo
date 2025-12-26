/**
 * ラスタライゼーション用のユーティリティ関数
 * 座標の整数化、Bresenhamアルゴリズム、太い線の計算、ブラシサイズの整数化を提供
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

export type StampOffsets = {
  offsets: Array<{ dx: number; dy: number }>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/**
 * 半径ごとの円オフセットテーブル（キャッシュ）
 * キー: 半径、値: その半径の円内のオフセット配列
 * ブラシサイズは実用範囲内を前提にし、キャッシュは上限を設けていない
 */
const circleOffsetCache = new Map<number, Array<{ dx: number; dy: number }>>();
const squareOffsetCache = new Map<number, StampOffsets>();
const lineOffsetCache = new Map<number, StampOffsets>();

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
 * 太い線の領域を計算（スタンプ方式 + テーブル化）
 * パフォーマンス最適化: 各中心点に対してテーブル化された円オフセットを使用
 * 重複排除はビットマスクで行う
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

  return calculateStampedLinePixels(
    centerPixels,
    getCircleStampOffsets(radius),
  );
}

export function calculateStampedLinePixels(
  centerPixels: Array<{ x: number; y: number }>,
  stamp: StampOffsets,
): Array<{ x: number; y: number }> {
  if (centerPixels.length === 0) {
    return [];
  }

  const first = centerPixels[0];
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;

  for (const center of centerPixels) {
    if (center.x < minX) minX = center.x;
    if (center.x > maxX) maxX = center.x;
    if (center.y < minY) minY = center.y;
    if (center.y > maxY) maxY = center.y;
  }

  const maskMinX = minX + stamp.minX;
  const maskMaxX = maxX + stamp.maxX;
  const maskMinY = minY + stamp.minY;
  const maskMaxY = maxY + stamp.maxY;
  const maskWidth = maskMaxX - maskMinX + 1;
  const maskHeight = maskMaxY - maskMinY + 1;

  if (maskWidth <= 0 || maskHeight <= 0) {
    return [];
  }

  const mask = new Uint8Array(maskWidth * maskHeight);
  const result: Array<{ x: number; y: number }> = [];

  for (const center of centerPixels) {
    const cx = center.x;
    const cy = center.y;

    for (const { dx, dy } of stamp.offsets) {
      const x = cx + dx;
      const y = cy + dy;
      const index = (y - maskMinY) * maskWidth + (x - maskMinX);
      if (mask[index] === 1) {
        continue;
      }
      mask[index] = 1;
      result.push({ x, y });
    }
  }

  return result;
}

export function getCircleStampOffsets(radius: number): StampOffsets {
  const safeRadius = Math.max(0, Math.floor(radius));
  return {
    offsets: getCircleOffsets(safeRadius),
    minX: -safeRadius,
    maxX: safeRadius,
    minY: -safeRadius,
    maxY: safeRadius,
  };
}

export function getSquareStampOffsets(size: number): StampOffsets {
  const safeSize = Math.max(1, Math.round(size));
  const cached = squareOffsetCache.get(safeSize);
  if (cached) {
    return cached;
  }

  const start = -Math.floor(safeSize / 2);
  const end = start + safeSize - 1;
  const offsets: Array<{ dx: number; dy: number }> = [];

  for (let dy = start; dy <= end; dy++) {
    for (let dx = start; dx <= end; dx++) {
      offsets.push({ dx, dy });
    }
  }

  const stamp = {
    offsets,
    minX: start,
    maxX: end,
    minY: start,
    maxY: end,
  };
  squareOffsetCache.set(safeSize, stamp);
  return stamp;
}

export function getLineStampOffsets(halfLength: number): StampOffsets {
  const safeHalfLength = Math.max(0, Math.round(halfLength));
  const cached = lineOffsetCache.get(safeHalfLength);
  if (cached) {
    return cached;
  }

  const offsets: Array<{ dx: number; dy: number }> = [];
  for (let dx = -safeHalfLength; dx <= safeHalfLength; dx++) {
    offsets.push({ dx, dy: 0 });
  }

  const stamp = {
    offsets,
    minX: -safeHalfLength,
    maxX: safeHalfLength,
    minY: 0,
    maxY: 0,
  };
  lineOffsetCache.set(safeHalfLength, stamp);
  return stamp;
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
