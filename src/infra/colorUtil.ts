export function parseColorToRgb(color: string): { r: number; g: number; b: number } {
  const hex = color.replace("#", "").trim();

  if (hex.length === 3) {
    const [r, g, b] = hex.split("").map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }

  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  // Fallback to black if parsing fails
  return { r: 0, g: 0, b: 0 };
}
