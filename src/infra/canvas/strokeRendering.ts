/**
 * ストローク描画ロジック
 * ピクセル単位でストロークを描画する機能を提供
 */

import { getPatternDefinition } from "@/core/patterns";
import type { PatternTile } from "@/core/patternTypes";
import {
  bresenhamLine,
  calculateStampedLinePixels,
  calculateThickLinePixels,
  getCirclePixelOffsets,
  getLineStampOffsets,
  getSquareStampOffsets,
} from "@/core/rasterization";
import type { BrushVariant, Stroke } from "@/core/types";
import type { ImageDataBuffer } from "@/infra/canvas/ImageDataBuffer";
import { parseColorToRgb, resolveCssVariable } from "@/infra/colorUtil";

/**
 * ストローク描画のコンテキスト
 */
export type StrokeRenderingContext = ImageDataBuffer;

/**
 * ピクセル単位でストロークを描画
 * ソリッド/消しゴムはBresenhamアルゴリズムでピクセル単位描画
 * パターンはピクセル単位で実装
 * すべてImageDataに書き込む（Canvas APIは呼ばない）
 */
export function renderStroke({
  context,
  stroke,
  jitteredPoints,
  elapsedTimeMs: _elapsedTimeMs,
}: {
  context: StrokeRenderingContext;
  stroke: Stroke;
  jitteredPoints: { x: number; y: number }[];
  elapsedTimeMs: number;
}): void {
  if (jitteredPoints.length === 0 || !context.hasImageData()) return;

  // パターンの場合はピクセル単位描画
  if (stroke.brush.kind === "pattern") {
    renderPatternStroke(context, stroke, jitteredPoints);
    return;
  }

  // ソリッド/消しゴムはピクセル単位描画
  renderSolidStroke(context, stroke, jitteredPoints);
}

/**
 * ソリッド/消しゴムをピクセル単位で描画（ImageDataに書き込む）
 */
function renderSolidStroke(
  context: StrokeRenderingContext,
  stroke: Stroke,
  jitteredPoints: { x: number; y: number }[],
): void {
  const brushWidth = Math.round(stroke.brush.width);
  const variant = stroke.brush.variant as BrushVariant | undefined;
  const eraserStampVariant = resolveEraserStampVariant({
    strokeKind: stroke.kind,
    variant,
  });

  // 色を取得
  let r: number;
  let g: number;
  let b: number;
  let a: number;

  if (stroke.kind === "erase") {
    // 消しゴム: 背景色で塗りつぶす
    const bg = context.getBackgroundColorRgba();
    r = bg.r;
    g = bg.g;
    b = bg.b;
    a = bg.a * 255; // 0-255に変換
  } else {
    // 通常のペン: ストロークの色を使用
    const color = parseColorToRgb(resolveCssVariable(stroke.brush.color));
    r = color.r;
    g = color.g;
    b = color.b;
    a = stroke.brush.opacity * 255; // 0-255に変換
  }

  if (eraserStampVariant) {
    const centerPixels = buildCenterPixels(jitteredPoints);
    const stamp = resolveEraserStamp({
      variant: eraserStampVariant,
      width: brushWidth,
    });
    const stampedPixels = calculateStampedLinePixels(centerPixels, stamp);
    for (const pixel of stampedPixels) {
      context.setPixel({ x: pixel.x, y: pixel.y, r, g, b, a });
    }
    return;
  }

  // 1点だけのとき
  if (jitteredPoints.length === 1) {
    const p = jitteredPoints[0];
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    drawPixelToImageData(context, x, y, brushWidth, r, g, b, a);
    return;
  }

  // パフォーマンス最適化: 太い線の場合は領域を直接計算
  if (brushWidth > 1) {
    const centerPixels = buildCenterPixels(jitteredPoints);

    // 太い線の領域を計算（重複排除済み）
    const thickPixels = calculateThickLinePixels(centerPixels, brushWidth);

    // 各ピクセルをImageDataに書き込む
    for (const pixel of thickPixels) {
      context.setPixel({ x: pixel.x, y: pixel.y, r, g, b, a });
    }
  } else {
    // width=1の場合は従来通り（最適化済み）
    const pixels = new Map<number, Set<number>>(); // x -> Set<y>

    for (let i = 0; i < jitteredPoints.length; i++) {
      const current = jitteredPoints[i];
      const x = Math.round(current.x);
      const y = Math.round(current.y);

      if (i === 0) {
        if (!pixels.has(x)) pixels.set(x, new Set());
        pixels.get(x)?.add(y);
      } else {
        const prev = jitteredPoints[i - 1];
        const prevX = Math.round(prev.x);
        const prevY = Math.round(prev.y);
        const linePixels = bresenhamLine(prevX, prevY, x, y);
        linePixels.forEach((pixel) => {
          if (!pixels.has(pixel.x)) pixels.set(pixel.x, new Set());
          pixels.get(pixel.x)?.add(pixel.y);
        });
      }
    }

    // 各ピクセルをImageDataに書き込む
    pixels.forEach((ys, x) => {
      ys.forEach((y) => {
        context.setPixel({ x, y, r, g, b, a });
      });
    });
  }
}

/**
 * 1ピクセルをImageDataに書き込む（太い線の場合は拡大）
 */
function drawPixelToImageData(
  context: StrokeRenderingContext,
  x: number,
  y: number,
  width: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  // 円スタンプの単点描画
  if (width === 1) {
    context.setPixel({ x, y, r, g, b, a });
  } else {
    const radius = Math.floor(width / 2);
    // テーブル化されたオフセットを使用（毎回計算しない）
    const offsets = getCirclePixelOffsets(radius);
    for (const { dx, dy } of offsets) {
      context.setPixel({ x: x + dx, y: y + dy, r, g, b, a });
    }
  }
}

function buildCenterPixels(
  jitteredPoints: { x: number; y: number }[],
): Array<{ x: number; y: number }> {
  const centerPixels: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < jitteredPoints.length; i++) {
    const current = jitteredPoints[i];
    const x = Math.round(current.x);
    const y = Math.round(current.y);

    if (i === 0) {
      centerPixels.push({ x, y });
    } else {
      const prev = jitteredPoints[i - 1];
      const prevX = Math.round(prev.x);
      const prevY = Math.round(prev.y);
      const linePixels = bresenhamLine(prevX, prevY, x, y);
      centerPixels.push(...linePixels.slice(1));
    }
  }

  return centerPixels;
}

function resolveEraserStamp({
  variant,
  width,
}: {
  variant: "eraserLine" | "eraserSquare";
  width: number;
}) {
  switch (variant) {
    case "eraserLine":
      return getLineStampOffsets(width);
    case "eraserSquare":
      return getSquareStampOffsets(width);
    default:
      return assertNever(variant);
  }
}

function resolveEraserStampVariant({
  strokeKind,
  variant,
}: {
  strokeKind: "draw" | "erase";
  variant: BrushVariant | undefined;
}): "eraserLine" | "eraserSquare" | null {
  if (strokeKind !== "erase") {
    return null;
  }

  switch (variant) {
    case "eraserLine":
    case "eraserSquare":
      return variant;
    case "eraserCircle":
    case "normal":
    case "pressure":
    case "noise":
    case undefined:
      return null;
    default:
      return assertNever(variant);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected eraser variant: ${value}`);
}

/**
 * パターンストロークをピクセル単位で描画（ImageDataに書き込む）
 * 最適化: まずエリアを特定してから、そのエリア全体にパターンを一括適用
 */
function renderPatternStroke(
  context: StrokeRenderingContext,
  stroke: Stroke,
  jitteredPoints: { x: number; y: number }[],
): void {
  if (stroke.brush.kind !== "pattern" || !stroke.brush.patternId) return;

  const patternDef = getPatternDefinition(stroke.brush.patternId);
  if (!patternDef) return;
  const tile = patternDef.tile;

  const color = parseColorToRgb(resolveCssVariable(stroke.brush.color));
  const brushWidth = Math.round(stroke.brush.width);

  let areaPixels: Array<{ x: number; y: number }>;

  // 1点だけのとき
  if (jitteredPoints.length === 1) {
    const p = jitteredPoints[0];
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (brushWidth > 1) {
      areaPixels = calculateThickLinePixels([{ x, y }], brushWidth);
    } else {
      areaPixels = [{ x, y }];
    }
  } else {
    // 複数点の場合はBresenhamアルゴリズムで中心線を取得
    const centerPixels: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < jitteredPoints.length; i++) {
      const current = jitteredPoints[i];
      const x = Math.round(current.x);
      const y = Math.round(current.y);

      if (i === 0) {
        centerPixels.push({ x, y });
      } else {
        const prev = jitteredPoints[i - 1];
        const prevX = Math.round(prev.x);
        const prevY = Math.round(prev.y);
        const linePixels = bresenhamLine(prevX, prevY, x, y);
        if (linePixels.length > 0) {
          centerPixels.push(...linePixels.slice(1));
        }
      }
    }

    // 太い線の場合は領域を計算（重複排除済み）
    if (brushWidth > 1) {
      areaPixels = calculateThickLinePixels(centerPixels, brushWidth);
    } else {
      areaPixels = centerPixels;
    }
  }

  // エリア全体にパターンを一括適用
  applyPatternToArea(
    context,
    areaPixels,
    tile,
    color.r,
    color.g,
    color.b,
    brushWidth,
  );
}

/**
 * エリア全体にパターンを適用（ImageDataに書き込む）
 */
function applyPatternToArea(
  context: StrokeRenderingContext,
  areaPixels: Array<{ x: number; y: number }>,
  tile: PatternTile,
  r: number,
  g: number,
  b: number,
  brushWidth: number,
): void {
  if (!context.hasImageData()) return;

  if (tile.width <= 0 || tile.height <= 0 || tile.alpha.length === 0) {
    return;
  }

  for (const { x, y } of areaPixels) {
    if (brushWidth === 1) {
      // width=1の場合: ドットの欠けを抑えるため近傍の濃さを距離で評価する
      let maxAlpha = 0;
      const searchRadius = 3;
      const maxDistanceSq = searchRadius * searchRadius;

      for (let distance = 0; distance <= searchRadius; distance++) {
        let foundClose = false;
        for (let dy = -distance; dy <= distance; dy++) {
          for (let dx = -distance; dx <= distance; dx++) {
            const dSq = dx * dx + dy * dy;
            if (dSq > maxDistanceSq) continue;

            const px = x + dx;
            const py = y + dy;
            const tileX = ((px % tile.width) + tile.width) % tile.width;
            const tileY = ((py % tile.height) + tile.height) % tile.height;
            const alphaIndex = tileY * tile.width + tileX;

            if (alphaIndex >= 0 && alphaIndex < tile.alpha.length) {
              const alpha = tile.alpha[alphaIndex];
              if (alpha > 0) {
                const approximateDistance = dSq / (1 + dSq);
                const weight =
                  dSq === 0 ? 1.0 : 1.0 / (1.0 + approximateDistance * 0.3);
                const weightedAlpha = alpha * weight;
                if (weightedAlpha > maxAlpha) {
                  maxAlpha = weightedAlpha;
                  if (distance <= 1) {
                    foundClose = true;
                  }
                }
              }
            }
          }
        }
        if (foundClose && maxAlpha >= 0.7) {
          break;
        }
      }
      if (maxAlpha > 0) {
        context.setPixel({ x, y, r, g, b, a: maxAlpha * 255 });
      }
    } else {
      // width > 1の場合: 各ピクセルについてパターンを計算
      const tileX = ((x % tile.width) + tile.width) % tile.width;
      const tileY = ((y % tile.height) + tile.height) % tile.height;
      const alphaIndex = tileY * tile.width + tileX;
      if (alphaIndex >= 0 && alphaIndex < tile.alpha.length) {
        const alpha = tile.alpha[alphaIndex];
        if (alpha > 0) {
          context.setPixel({ x, y, r, g, b, a: alpha * 255 });
        }
      }
    }
  }
}
