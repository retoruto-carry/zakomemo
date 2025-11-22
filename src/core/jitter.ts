import type { Point } from "./types";

export type JitterConfig = {
  amplitude: number;
  frequency: number;
};

export type JitterOffset = {
  dx: number;
  dy: number;
};

function hashNoise(a: number, b: number, c: number): number {
  // Simple deterministic hash -> 0..1
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

export function computeJitter(
  point: Point,
  timeMs: number,
  config: JitterConfig,
): JitterOffset {
  // Quantize時間ベースの揺れでジャギー感を出す
  const bucket = Math.floor((point.t + timeMs) * config.frequency);
  const amplitude = config.amplitude;

  const noiseX = hashNoise(point.x, point.y, bucket);
  const noiseY = hashNoise(point.y, point.x, bucket + 1);

  return {
    dx: (noiseX * 2 - 1) * amplitude,
    dy: (noiseY * 2 - 1) * amplitude,
  };
}
