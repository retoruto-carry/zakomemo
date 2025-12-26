"use client";

import type React from "react";
import { useMemo } from "react";
import { getPatternDefinition } from "@/core/patterns";
import type { BrushPatternId } from "@/core/types";

export type PatternPreviewProps = {
  patternId: BrushPatternId;
  pixelSize: number;
  repeat: number;
  className?: string;
};

export function PatternPreview({
  patternId,
  pixelSize,
  repeat,
  className,
}: PatternPreviewProps): React.ReactElement {
  const { tile, preview } = getPatternDefinition(patternId);
  const previewTile = preview ?? tile;
  const repeatWidth = previewTile.width * repeat;
  const repeatHeight = previewTile.height * repeat;
  const cells = useMemo(() => {
    const result: React.ReactElement[] = [];
    for (let y = 0; y < repeatHeight; y += 1) {
      const rowOffset = (y % previewTile.height) * previewTile.width;
      for (let x = 0; x < repeatWidth; x += 1) {
        const value = previewTile.alpha[rowOffset + (x % previewTile.width)];
        result.push(
          <div
            key={`${patternId}-${x}-${y}`}
            style={{
              width: pixelSize,
              height: pixelSize,
              backgroundColor: value ? "#000" : "transparent",
            }}
          />,
        );
      }
    }
    return result;
  }, [patternId, pixelSize, repeatWidth, repeatHeight, previewTile]);

  return (
    <div
      className={`grid ${className ?? ""}`}
      style={{
        gridTemplateColumns: `repeat(${repeatWidth}, ${pixelSize}px)`,
        gridTemplateRows: `repeat(${repeatHeight}, ${pixelSize}px)`,
        width: repeatWidth * pixelSize,
        height: repeatHeight * pixelSize,
      }}
      aria-hidden="true"
    >
      {cells}
    </div>
  );
}
