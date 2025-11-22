import type { PatternDefinition } from "./patternTypes";
import type { BrushPatternId } from "./types";

export const PATTERNS: PatternDefinition[] = [
  {
    id: "dots",
    tile: {
      width: 8,
      height: 8,
      alpha: [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0, //
        0,
        1,
        1,
        0,
        0,
        0,
        0,
        0, //
        0,
        1,
        1,
        0,
        0,
        0,
        0,
        0, //
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0, //
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0, //
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0, //
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0, //
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ],
    },
  },
  {
    id: "dotsDense",
    tile: {
      width: 8,
      height: 8,
      alpha: [
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1, //
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1, //
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0, //
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1, //
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1, //
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0, //
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1, //
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
      ],
    },
  },
  {
    id: "horizontal",
    tile: {
      width: 10,
      height: 10,
      alpha: [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
    },
  },
  {
    id: "vertical",
    tile: {
      width: 10,
      height: 10,
      alpha: [
        1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0,
        0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0,
        0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1,
        0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1,
        1, 0, 0, 0,
      ],
    },
  },
  {
    id: "checker",
    tile: {
      width: 8,
      height: 8,
      alpha: [
        1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1,
        0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0,
        0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1,
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
