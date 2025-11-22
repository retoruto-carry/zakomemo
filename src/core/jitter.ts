import type { Point } from "./types";

export type JitterConfig = {
  amplitude: number;
  frequency: number;
};

export type JitterOffset = {
  dx: number;
  dy: number;
};

export function computeJitter(
  point: Point,
  timeMs: number,
  config: JitterConfig
): JitterOffset {
  const t = (point.t + timeMs) * config.frequency;
  const amplitude = config.amplitude;

  return {
    dx: Math.sin(t * 2.3) * amplitude,
    dy: Math.cos(t * 1.7) * amplitude,
  };
}
