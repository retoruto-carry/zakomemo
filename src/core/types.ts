export type BrushKind = "solid" | "pattern";

export type BrushPatternId =
  | "dots"
  | "dotsDense"
  | "stripesThin"
  | "horizontal"
  | "checker";

export type BrushSettings = {
  kind: BrushKind;
  color: string;
  width: number;
  opacity: number;
  patternId?: BrushPatternId;
};

export type StrokeKind = "draw" | "erase";

export type Point = {
  x: number;
  y: number;
  t: number;
};

export type Stroke = {
  id: string;
  kind: StrokeKind;
  brush: BrushSettings;
  points: Point[];
};

export type Drawing = {
  width: number;
  height: number;
  strokes: Stroke[];
};
