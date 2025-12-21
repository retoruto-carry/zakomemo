import type { Point } from "./types";

export type JitterConfig = {
  amplitude: number;
  frequency: number;
};

export type JitterOffset = {
  dx: number;
  dy: number;
};

export function hashNoise(a: number, b: number, c: number): number {
  // Simple deterministic hash -> 0..1
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

export function computeJitter(
  point: Point,
  elapsedTimeMs: number,
  config: JitterConfig,
): JitterOffset {
  // Quantize時間ベースの揺れでジャギー感を出す
  const bucket = Math.floor((point.t + elapsedTimeMs) * config.frequency);
  const amplitude = config.amplitude;

  const noiseX = hashNoise(point.x, point.y, bucket);
  const noiseY = hashNoise(point.y, point.x, bucket + 1);

  return {
    dx: (noiseX * 2 - 1) * amplitude,
    dy: (noiseY * 2 - 1) * amplitude,
  };
}

/**
 * 座標ベースのjitterを計算（point.tを使わない）
 * パターン描画で使用し、同じ座標には同じjitterが適用される
 * これにより別のストロークで同じ場所に描いてもパターンがずれない
 */
export function computePatternJitter(
  point: Point,
  elapsedTimeMs: number,
  config: JitterConfig,
): JitterOffset {
  // point.tを使わず、elapsedTimeMsのみで時間変化を計算
  const bucket = Math.floor(elapsedTimeMs * config.frequency);
  const amplitude = config.amplitude;

  // 座標に基づいたノイズ（同じ座標なら同じ結果）
  const noiseX = hashNoise(point.x, point.y, bucket);
  const noiseY = hashNoise(point.y, point.x, bucket + 1);

  return {
    dx: (noiseX * 2 - 1) * amplitude,
    dy: (noiseY * 2 - 1) * amplitude,
  };
}
