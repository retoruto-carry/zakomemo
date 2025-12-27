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

/**
 * スタンプ描画用のオフセットと、その範囲（バウンディングボックス）
 */
export type StampOffsets = {
  /** スタンプの相対オフセット */
  offsets: Array<{ dx: number; dy: number }>;
  /** オフセットの最小X */
  minX: number;
  /** オフセットの最大X */
  maxX: number;
  /** オフセットの最小Y */
  minY: number;
  /** オフセットの最大Y */
  maxY: number;
};

/**
 * 半径ごとの円スタンプテーブル（キャッシュ）
 * キー: 半径、値: その半径の円内オフセットと範囲
 * ブラシサイズは実用範囲内を前提にし、キャッシュは上限を設けていない
 */
const circleStampCache = new Map<number, StampOffsets>();
const squareOffsetCache = new Map<number, StampOffsets>();
const lineOffsetCache = new Map<number, StampOffsets>();

/**
 * 指定半径の円スタンプを取得（テーブル化）
 * パフォーマンス最適化: 半径ごとにオフセットを事前計算してキャッシュ
 * @param radius 半径（0.5刻みなどの小数も許容）
 * @returns 円スタンプのオフセットと範囲
 */
function getCircleStamp(radius: number): StampOffsets {
  const safeRadius = Math.max(0, radius);

  // キャッシュをチェック
  const cached = circleStampCache.get(safeRadius);
  if (cached) {
    return cached;
  }

  // テーブルを生成
  const offsets: Array<{ dx: number; dy: number }> = [];
  const radiusSq = safeRadius * safeRadius;
  const limit = Math.ceil(safeRadius);
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let hasOffset = false;

  for (let dy = -limit; dy <= limit; dy++) {
    for (let dx = -limit; dx <= limit; dx++) {
      const dSq = dx * dx + dy * dy;
      if (dSq <= radiusSq) {
        offsets.push({ dx, dy });
        if (!hasOffset) {
          minX = dx;
          maxX = dx;
          minY = dy;
          maxY = dy;
          hasOffset = true;
        } else {
          minX = Math.min(minX, dx);
          maxX = Math.max(maxX, dx);
          minY = Math.min(minY, dy);
          maxY = Math.max(maxY, dy);
        }
      }
    }
  }

  // 念のためオフセットが空なら中心点のみ
  if (!hasOffset) {
    offsets.push({ dx: 0, dy: 0 });
    minX = 0;
    maxX = 0;
    minY = 0;
    maxY = 0;
  }

  const stamp = {
    offsets,
    minX,
    maxX,
    minY,
    maxY,
  };

  // キャッシュに保存
  circleStampCache.set(safeRadius, stamp);
  return stamp;
}

/**
 * 太い線の領域を計算（スタンプ方式 + テーブル化）
 * パフォーマンス最適化: 各中心点に対してテーブル化された円オフセットを使用
 * 重複排除はビットマスクで行う
 * @param centerPixels 中心線上のピクセル座標の配列
 * @param width 線の太さ（直径扱い、半径はwidth/2で評価）
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

  const radius = width / 2;
  if (radius <= 0) {
    return centerPixels;
  }

  return calculateStampedLinePixels(
    centerPixels,
    getCircleStampOffsets(radius),
  );
}

/**
 * 任意スタンプで中心線を塗りつぶす
 * 重複排除はビットマスクで行う
 * @param centerPixels 中心線上のピクセル座標の配列
 * @param stamp スタンプのオフセットと範囲
 * @returns 塗りつぶすべきピクセル座標の配列（重複排除済み）
 */
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

/**
 * 円スタンプのオフセットと範囲を取得
 * @param radius 半径（0.5刻みなどの小数も許容）
 * @returns 円スタンプのオフセットと範囲
 */
export function getCircleStampOffsets(radius: number): StampOffsets {
  return getCircleStamp(radius);
}

/**
 * 四角スタンプのオフセットと範囲を取得
 * @param width 四角の一辺の長さ（px）
 * @returns 四角スタンプのオフセットと範囲
 */
export function getSquareStampOffsets(width: number): StampOffsets {
  const safeSize = Math.max(1, Math.round(width));
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

/**
 * 横線スタンプのオフセットと範囲を取得
 * @param width 横線の長さ（px）
 * @returns 横線スタンプのオフセットと範囲
 */
export function getLineStampOffsets(width: number): StampOffsets {
  const safeSize = Math.max(1, Math.round(width));
  const cached = lineOffsetCache.get(safeSize);
  if (cached) {
    return cached;
  }

  const start = -Math.floor(safeSize / 2);
  const end = start + safeSize - 1;
  const offsets: Array<{ dx: number; dy: number }> = [];
  for (let dx = start; dx <= end; dx++) {
    offsets.push({ dx, dy: 0 });
  }

  const stamp = {
    offsets,
    minX: start,
    maxX: end,
    minY: 0,
    maxY: 0,
  };
  lineOffsetCache.set(safeSize, stamp);
  return stamp;
}

/**
 * 円を描画するためのオフセット配列を取得（テーブル化）
 * パフォーマンス最適化: 半径ごとにオフセットを事前計算
 * @param radius 半径（0.5刻みなどの小数も許容）
 * @returns 円内のオフセット配列 [{dx, dy}, ...]
 */
export function getCirclePixelOffsets(
  radius: number,
): Array<{ dx: number; dy: number }> {
  return getCircleStamp(radius).offsets;
}
