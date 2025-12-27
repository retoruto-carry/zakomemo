import type { BrushPatternId } from "@/core/types";

/** パターンタイルの定義 */
export type PatternTile = {
  width: number;
  height: number;
  alpha: number[];
};

/** パターン定義 */
export type PatternDefinition = {
  id: BrushPatternId;
  tile: PatternTile;
  previewRepeatTime: number;
};
