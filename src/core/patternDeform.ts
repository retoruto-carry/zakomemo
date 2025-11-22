import type { PatternTile } from "./patternTypes";

export type PatternWiggleConfig = {
  amplitude: number;
  frequency: number;
};

export function wigglePatternTile(
  base: PatternTile,
  timeMs: number,
  config: PatternWiggleConfig
): PatternTile {
  const { width, height, alpha } = base;
  const outputAlpha = new Array<number>(alpha.length);

  const t = timeMs * config.frequency;
  const amplitude = config.amplitude;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / width;
      const ny = y / height;

      const dx = Math.sin((nx + t) * Math.PI * 2) * amplitude;
      const dy = Math.cos((ny + t * 1.3) * Math.PI * 2) * amplitude;

      const sx = mod(Math.round(x + dx), width);
      const sy = mod(Math.round(y + dy), height);

      const srcIndex = sy * width + sx;
      const dstIndex = y * width + x;

      outputAlpha[dstIndex] = alpha[srcIndex];
    }
  }

  return {
    width,
    height,
    alpha: outputAlpha,
  };
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}
