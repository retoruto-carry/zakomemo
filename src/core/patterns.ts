import type { PatternDefinition } from "./patternTypes";
import type { BrushPatternId } from "./types";

export const PATTERNS: PatternDefinition[] = [
  {
    id: "dot_sparse",
    tile: {
      width: 8,
      height: 8,
      // biome-ignore format: パターンの行分割を維持するため
      alpha: [
        0,0,0,0,0,0,0,0,
        0,1,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        0,1,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
      ],
    },
  },
  {
    id: "dot_dense",
    tile: {
      width: 8,
      height: 8,
      // biome-ignore format: パターンの行分割を維持するため
      alpha: [
        0,0,0,0,0,0,0,0,
        0,1,0,1,0,1,0,1,
        0,0,0,0,0,0,0,0,
        0,1,0,1,0,1,0,1,
        0,0,0,0,0,0,0,0,
        0,1,0,1,0,1,0,1,
        0,0,0,0,0,0,0,0,
        0,1,0,1,0,1,0,1,
      ],
    },
  },
  {
    id: "stripe_horizontal",
    tile: {
      width: 8,
      height: 8,
      // biome-ignore format: パターンの行分割を維持するため
      alpha: [
        0,0,0,0,0,0,0,0,
        1,1,1,1,0,0,0,0,
        1,1,1,1,0,0,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        1,1,1,1,0,0,0,0,
        1,1,1,1,0,0,0,0,
        0,0,0,0,0,0,0,0,
      ],
    },
  },
  {
    id: "stripe_vertical",
    tile: {
      width: 8,
      height: 8,
      // biome-ignore format: パターンの行分割を維持するため
      alpha: [
        0,1,0,0,0,1,0,0,
        0,1,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        0,1,0,0,0,1,0,0,
        0,1,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
      ],
    },
  },
  {
    id: "check",
    tile: {
      width: 8,
      height: 8,
      // biome-ignore format: パターンの行分割を維持するため
      alpha: [
        1,0,0,0,0,0,0,1,
        0,1,0,0,0,0,1,0,
        0,0,1,0,0,1,0,0,
        0,0,0,1,1,0,0,0,
        0,0,0,1,1,0,0,0,
        0,0,1,0,0,1,0,0,
        0,1,0,0,0,0,1,0,
        1,0,0,0,0,0,0,1,
      ],
    },
  },
  {
    id: "mesh",
    tile: {
      width: 8,
      height: 8,
      // biome-ignore format: パターンの行分割を維持するため
      alpha: [
        0,1,0,0,0,1,0,0,
        1,0,1,0,1,0,1,0,
        0,1,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,
        0,1,0,0,0,1,0,0,
        1,0,1,0,1,0,1,0,
        0,1,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,
      ],
    },
  },
  {
    id: "mesh_bold",
    tile: {
      width: 8,
      height: 8,
      // biome-ignore format: パターンの行分割を維持するため
      alpha: [
        1,1,0,0,1,1,0,0,
        1,1,0,0,1,1,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        1,1,0,0,1,1,0,0,
        1,1,0,0,1,1,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
      ],
    },
  },
  {
    id: "crosshatch",
    tile: {
      width: 8,
      height: 8,
      // biome-ignore format: パターンの行分割を維持するため
      alpha: [
        1,0,0,0,0,0,0,1,
        0,1,0,0,0,0,1,0,
        0,0,1,0,0,1,0,0,
        0,0,0,1,1,0,0,0,
        0,0,0,1,1,0,0,0,
        0,0,1,0,0,1,0,0,
        0,1,0,0,0,0,1,0,
        1,0,0,0,0,0,0,1,
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
