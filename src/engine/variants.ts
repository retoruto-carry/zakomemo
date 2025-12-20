export type PenVariant = "normal";
export type EraserVariant = "eraserCircle" | "eraserSquare" | "eraserLine";

export const defaultPenWidth: Record<PenVariant, number> = {
  normal: 16,
};

export const defaultEraserWidth: Record<EraserVariant, number> = {
  eraserCircle: 12,
  eraserSquare: 12,
  eraserLine: 14,
};

export function resolveWidthVariant(
  base: number,
  _variant: PenVariant | EraserVariant,
  _dist: number,
  _timeSinceStart: number,
  _strokeKind: "draw" | "erase",
): number {
  return base;
}
