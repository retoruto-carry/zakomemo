import type { EraserVariant, PenVariant } from "@/engine/variants";

/** ペンのバリアント選択肢 */
export const penVariants: { id: PenVariant; label: string }[] = [
  { id: "normal", label: "丸" },
  { id: "penSquare", label: "四角" },
];

/** 消しゴムのバリアント選択肢 */
export const eraserVariants: { id: EraserVariant; label: string }[] = [
  { id: "eraserCircle", label: "丸" },
  { id: "eraserSquare", label: "四角" },
  { id: "eraserLine", label: "線" },
];
