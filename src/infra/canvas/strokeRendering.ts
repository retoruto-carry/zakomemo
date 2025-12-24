/**
 * ストローク描画ロジック
 * ピクセル単位でストロークを描画する機能を提供
 */

import { getPatternDefinition } from "../../core/patterns";
import type { PatternTile } from "../../core/patternTypes";
import {
  bresenhamLine,
  calculateThickLinePixels,
  getCirclePixelOffsets,
} from "../../core/rasterization";
import type { BrushVariant, Stroke } from "../../core/types";
import { parseColorToRgb, resolveCssVariable } from "../colorUtil";
import type { ImageDataContext } from "./imageDataManager";
import { setPixel } from "./imageDataManager";

/**
 * ストローク描画のコンテキスト
 */
export interface StrokeRenderingContext extends ImageDataContext {
  backgroundColorRgba: { r: number; g: number; b: number; a: number };
}

/**
 * ピクセル単位でストロークを描画
 * ソリッド/消しゴムはBresenhamアルゴリズムでピクセル単位描画
 * パターンはピクセル単位で実装
 * すべてImageDataに書き込む（Canvas APIは呼ばない）
 */
export function renderStroke(
  context: StrokeRenderingContext,
  stroke: Stroke,
  jitteredPoints: { x: number; y: number }[],
  _elapsedTimeMs: number,
): void {
  if (jitteredPoints.length === 0 || !context.data) return;

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

  // 色を取得
  let r: number;
  let g: number;
  let b: number;
  let a: number;

  if (stroke.kind === "erase") {
    // 消しゴム: 背景色で塗りつぶす
    const bg = context.backgroundColorRgba;
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

  // 1点だけのとき
  if (jitteredPoints.length === 1) {
    const p = jitteredPoints[0];
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    drawPixelToImageData(
      context,
      x,
      y,
      brushWidth,
      variant,
      stroke.kind,
      r,
      g,
      b,
      a,
    );
    return;
  }

  // パフォーマンス最適化: 太い線の場合は領域を直接計算
  if (brushWidth > 1) {
    // 中心線を取得
    const centerPixels: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < jitteredPoints.length; i++) {
      const current = jitteredPoints[i];
      const x = Math.round(current.x);
      const y = Math.round(current.y);

      if (i === 0) {
        centerPixels.push({ x, y });
      } else {
        // 前の点から現在の点までBresenhamで線を描画
        const prev = jitteredPoints[i - 1];
        const prevX = Math.round(prev.x);
        const prevY = Math.round(prev.y);
        const linePixels = bresenhamLine(prevX, prevY, x, y);
        // 最初の点は重複するのでスキップ
        if (linePixels.length > 0) {
          centerPixels.push(...linePixels.slice(1));
        }
      }
    }

    // 太い線の領域を計算（重複排除済み）
    const thickPixels = calculateThickLinePixels(centerPixels, brushWidth);

    // 各ピクセルをImageDataに書き込む
    for (const pixel of thickPixels) {
      setPixel(context, pixel.x, pixel.y, r, g, b, a);
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
        setPixel(context, x, y, r, g, b, a);
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
  variant: BrushVariant | undefined,
  strokeKind: "draw" | "erase",
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (strokeKind === "erase" && variant === "eraserLine") {
    // 消しゴム（横線）: 横方向に拡大
    const halfLen = Math.round(width);
    for (let dx = -halfLen; dx <= halfLen; dx++) {
      setPixel(context, x + dx, y, r, g, b, a);
    }
  } else if (strokeKind === "erase" && variant === "eraserSquare") {
    // 消しゴム（四角）: 四角形で描画
    const halfWidth = Math.floor(width / 2);
    for (let dy = -halfWidth; dy < halfWidth; dy++) {
      for (let dx = -halfWidth; dx < halfWidth; dx++) {
        setPixel(context, x + dx, y + dy, r, g, b, a);
      }
    }
  } else {
    // 通常のペン/消しゴム（円）: 円で描画
    if (width === 1) {
      setPixel(context, x, y, r, g, b, a);
    } else {
      const radius = Math.floor(width / 2);
      // テーブル化されたオフセットを使用（毎回計算しない）
      const offsets = getCirclePixelOffsets(radius);
      for (const { dx, dy } of offsets) {
        setPixel(context, x + dx, y + dy, r, g, b, a);
      }
    }
  }
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
  if (!context.data) return;

  if (tile.width <= 0 || tile.height <= 0 || tile.alpha.length === 0) {
    return;
  }

  for (const { x, y } of areaPixels) {
    if (brushWidth === 1) {
      // width=1の場合: 周囲をチェックしてパターンを適用
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
        setPixel(context, x, y, r, g, b, maxAlpha * 255);
      }
    } else {
      // width > 1の場合: 各ピクセルについてパターンを計算
      const tileX = ((x % tile.width) + tile.width) % tile.width;
      const tileY = ((y % tile.height) + tile.height) % tile.height;
      const alphaIndex = tileY * tile.width + tileX;
      if (alphaIndex >= 0 && alphaIndex < tile.alpha.length) {
        const alpha = tile.alpha[alphaIndex];
        if (alpha > 0) {
          setPixel(context, x, y, r, g, b, alpha * 255);
        }
      }
    }
  }
}
