import type { BrushColor } from "@/core/types";

/**
 * CSS変数を解決（SSR時はそのまま返す）
 */
export function resolveCssVariable(color: string): string {
  if (typeof window === "undefined") return color;
  if (!color.startsWith("var(")) return color;

  const match = color.match(/var\((--[^,)]+)/);
  if (!match) return color;

  const varName = match[1];
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || color;
}

/** パレット参照の解決に失敗した時のフォールバック色 */
const FALLBACK_BRUSH_COLOR = "#000000";

/**
 * パレット参照/固定色をCSS色に解決する
 * @param color ブラシ色
 * @param palette パレット配色
 */
export function resolveBrushColor({
  color,
  palette,
}: {
  color: BrushColor;
  palette: string[];
}): string {
  if (color.kind === "fixed") {
    return color.color;
  }
  return palette[color.index] ?? FALLBACK_BRUSH_COLOR;
}

/**
 * CSS色文字列をRGBに変換（3桁/6桁のhex形式に対応）
 * パースに失敗した場合は黒を返す
 */
export function parseColorToRgb(color: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const resolved = resolveCssVariable(color);
  const hex = resolved.replace("#", "").trim();

  if (hex.length === 3) {
    const [r, g, b] = hex.split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }

  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b, a: 1 };
  }

  // パースに失敗した場合は黒を返す
  return { r: 0, g: 0, b: 0, a: 1 };
}
