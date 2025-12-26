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
  const { tile, previewShiftX, previewShiftY } =
    getPatternDefinition(patternId);
  const repeatWidth = tile.width * repeat;
  const repeatHeight = tile.height * repeat;
  const cells = useMemo(() => {
    const result: React.ReactElement[] = [];
    for (let y = 0; y < repeatHeight; y += 1) {
      const rowOffset = (y % tile.height) * tile.width;
      for (let x = 0; x < repeatWidth; x += 1) {
        const value = tile.alpha[rowOffset + (x % tile.width)];
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
  }, [patternId, pixelSize, repeatWidth, repeatHeight, tile]);

  const shiftX = previewShiftX * pixelSize;
  const shiftY = previewShiftY * pixelSize;

  return (
    <div
      className={className}
      style={{
        width: repeatWidth * pixelSize,
        height: repeatHeight * pixelSize,
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${repeatWidth}, ${pixelSize}px)`,
          gridTemplateRows: `repeat(${repeatHeight}, ${pixelSize}px)`,
          width: repeatWidth * pixelSize,
          height: repeatHeight * pixelSize,
          transform: `translate(${shiftX}px, ${shiftY}px)`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
