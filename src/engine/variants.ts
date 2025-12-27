/** ペンのバリアント種別 */
export type PenVariant = "normal" | "penSquare";
/** 消しゴムのバリアント種別 */
export type EraserVariant = "eraserCircle" | "eraserSquare" | "eraserLine";

/** ペンのデフォルト幅 */
export const defaultPenWidth: Record<PenVariant, number> = {
  normal: 16,
  penSquare: 16,
};

/** 消しゴムのデフォルト幅 */
export const defaultEraserWidth: Record<EraserVariant, number> = {
  eraserCircle: 12,
  eraserSquare: 12,
  eraserLine: 14,
};

/**
 * バリアントに応じた幅を返す
 *
 * 現在の実装ではベース幅をそのまま返す（将来的に拡張可能）
 */
export function resolveWidthVariant(
  base: number,
  _variant: PenVariant | EraserVariant,
  _dist: number,
  _timeSinceStart: number,
  _strokeKind: "draw" | "erase",
): number {
  return base;
}
