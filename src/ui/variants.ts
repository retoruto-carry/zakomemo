import type { EraserVariant, PenVariant } from "@/engine/variants";

export const penVariants: { id: PenVariant; label: string }[] = [
  { id: "normal", label: "ノーマル" },
];

export const eraserVariants: { id: EraserVariant; label: string }[] = [
  { id: "eraserCircle", label: "丸" },
  { id: "eraserSquare", label: "四角" },
  { id: "eraserLine", label: "線" },
];
