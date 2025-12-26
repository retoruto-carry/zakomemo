import type { BrushPatternId } from "./types";

export type PatternTile = {
  width: number;
  height: number;
  alpha: number[];
};

export type PatternDefinition = {
  id: BrushPatternId;
  tile: PatternTile;
  previewRepeatTime: number;
};
