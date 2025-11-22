import type { BrushPatternId } from "./types";
import type { PatternDefinition } from "./patternTypes";

export const PATTERNS: PatternDefinition[] = [
  {
    id: "dots",
    tile: {
      width: 4,
      height: 4,
      alpha: [
        0, 0, 0, 0, //
        0, 1, 0, 0, //
        0, 0, 0, 0, //
        0, 0, 0, 1,
      ],
    },
  },
  {
    id: "stripes",
    tile: {
      width: 4,
      height: 4,
      // vertical stripes
      alpha: [
        1, 0, 1, 0, //
        1, 0, 1, 0, //
        1, 0, 1, 0, //
        1, 0, 1, 0,
      ],
    },
  },
  {
    id: "checker",
    tile: {
      width: 4,
      height: 4,
      alpha: [
        1, 0, 1, 0, //
        0, 1, 0, 1, //
        1, 0, 1, 0, //
        0, 1, 0, 1,
      ],
    },
  },
];

export function getPatternDefinition(id: BrushPatternId): PatternDefinition {
  const definition = PATTERNS.find((pattern) => pattern.id === id);
  if (!definition) {
    throw new Error(`Unknown pattern id: ${id}`);
  }
  return definition;
}
