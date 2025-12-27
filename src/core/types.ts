/** ブラシ種別（通常/パターン） */
export type BrushKind = "solid" | "pattern";

/** パターンブラシID */
export type BrushPatternId =
  | "dot_sparse"
  | "dot_dense"
  | "stripe_horizontal"
  | "stripe_vertical"
  | "check"
  | "mesh"
  | "mesh_bold"
  | "crosshatch";

/** パレット参照または固定色で表現するブラシ色 */
export type BrushColor =
  | { kind: "palette"; index: number }
  | { kind: "fixed"; color: string };

/** ブラシのバリアント */
export type BrushVariant =
  | "penCircle"
  | "penSquare"
  | "eraserCircle"
  | "eraserSquare"
  | "eraserLine";

/** ソリッドブラシの設定 */
export type SolidBrushSettings = {
  kind: "solid";
  color: BrushColor;
  width: number;
  opacity: number;
  variant: BrushVariant;
};

/** パターンブラシの設定 */
export type PatternBrushSettings = {
  kind: "pattern";
  color: BrushColor;
  width: number;
  opacity: number;
  patternId: BrushPatternId;
  variant: BrushVariant;
};

/** ブラシ設定 */
export type BrushSettings = SolidBrushSettings | PatternBrushSettings;

/** ストローク種別 */
export type StrokeKind = "draw" | "erase";

/** 描画ポイント */
export type Point = {
  x: number;
  y: number;
  t: number;
};

/** 描画ストローク */
export type Stroke = {
  id: string;
  kind: StrokeKind;
  brush: BrushSettings;
  points: Point[];
};

/** 描画データ */
export type Drawing = {
  width: number;
  height: number;
  strokes: Stroke[];
};
