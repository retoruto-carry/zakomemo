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
    id: "dotsDense",
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
  {
    id: "stripesThin",
    tile: {
      width: 6,
      height: 6,
      alpha: [
        1, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0,
      ],
    },
  },
  {
    id: "stripesBold",
    tile: {
      width: 6,
      height: 6,
      alpha: [
        1, 1, 1, 0, 0, 0,
        1, 1, 1, 0, 0, 0,
        1, 1, 1, 0, 0, 0,
        1, 1, 1, 0, 0, 0,
        1, 1, 1, 0, 0, 0,
        1, 1, 1, 0, 0, 0,
      ],
    },
  },
  {
    id: "horizontal",
    tile: {
      width: 6,
      height: 6,
      alpha: [
        1, 1, 1, 1, 1, 1,
        0, 0, 0, 0, 0, 0,
        1, 1, 1, 1, 1, 1,
        0, 0, 0, 0, 0, 0,
        1, 1, 1, 1, 1, 1,
        0, 0, 0, 0, 0, 0,
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
  {
    id: "checkerDense",
    tile: {
      width: 6,
      height: 6,
      alpha: [
        1, 1, 0, 1, 1, 0,
        1, 1, 0, 1, 1, 0,
        0, 0, 1, 0, 0, 1,
        1, 1, 0, 1, 1, 0,
        1, 1, 0, 1, 1, 0,
        0, 0, 1, 0, 0, 1,
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
