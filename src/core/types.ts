export type BrushKind = "solid" | "pattern";

export type BrushPatternId =
  | "dot_sparse"
  | "dot_dense"
  | "stripe_horizontal"
  | "stripe_vertical"
  | "check"
  | "mesh"
  | "mesh_bold"
  | "crosshatch";

export type BrushVariant =
  | "normal"
  | "pressure"
  | "noise"
  | "eraserCircle"
  | "eraserSquare"
  | "eraserLine";

export type BrushSettings = {
  kind: BrushKind;
  color: string;
  width: number;
  opacity: number;
  patternId?: BrushPatternId;
  variant?: BrushVariant;
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
