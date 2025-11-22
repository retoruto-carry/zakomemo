export type PenVariant = "normal" | "pressure" | "noise";
export type EraserVariant = "eraserCircle" | "eraserSquare" | "eraserLine";

export const defaultPenWidth: Record<PenVariant, number> = {
  normal: 4,
  pressure: 4,
  noise: 4,
};

export const defaultEraserWidth: Record<EraserVariant, number> = {
  eraserCircle: 12,
  eraserSquare: 12,
  eraserLine: 14,
};

export function resolveWidthVariant(
  base: number,
  variant: PenVariant | EraserVariant,
  dist: number,
  timeSinceStart: number,
  strokeKind: "draw" | "erase",
): number {
  if (strokeKind === "erase") {
    return base;
  }

  if (variant === "pressure") {
    const speed = timeSinceStart > 0 ? dist / timeSinceStart : 0;
    const factor = Math.min(1.5, 0.6 + speed * 0.8);
    return Math.max(1, base * factor);
  }

  if (variant === "noise") {
    const jitter =
      (Math.sin(timeSinceStart * 0.02) + Math.cos(timeSinceStart * 0.031)) *
      0.2;
    return Math.max(1, base * (1 + jitter));
  }

  return base;
}
