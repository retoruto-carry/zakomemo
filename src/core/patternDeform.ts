import type { JitterConfig } from "./jitter";
import { hashNoise } from "./jitter";
import type { PatternTile } from "./patternTypes";

export type PatternWiggleConfig = {
  amplitude: number;
  frequency: number;
};

/**
 * パターンタイル内の各ピクセルに座標ベースのjitterを適用して歪ませる
 * @param base 元のパターンタイル
 * @param elapsedTimeMs エンジン開始からの経過時間（ミリ秒）
 * @param config パターンの歪み設定
 * @param jitterConfig jitter設定（座標ベースの歪み用）
 * @param tileWorldX タイルのワールド座標X（オプション、指定しない場合はタイル内相対座標を使用）
 * @param tileWorldY タイルのワールド座標Y（オプション、指定しない場合はタイル内相対座標を使用）
 */
export function wigglePatternTile(
  base: PatternTile,
  elapsedTimeMs: number,
  config: PatternWiggleConfig,
  jitterConfig?: JitterConfig,
  tileWorldX?: number,
  tileWorldY?: number,
): PatternTile {
  const { width, height, alpha } = base;
  const outputAlpha = new Array<number>(alpha.length);

  const t = elapsedTimeMs * config.frequency;
  const amplitude = config.amplitude;

  // 座標ベースのjitterを使用するかどうか
  const useCoordinateJitter = jitterConfig !== undefined;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / width;
      const ny = y / height;

      // 時間ベースの周期的な歪み
      const timeDx = Math.sin((nx + t) * Math.PI * 2) * amplitude;
      const timeDy = Math.cos((ny + t * 1.3) * Math.PI * 2) * amplitude;

      // 座標ベースのjitter（オプション）
      let coordDx = 0;
      let coordDy = 0;
      if (useCoordinateJitter && jitterConfig) {
        // ワールド座標が指定されている場合はそれを使用、そうでなければタイル内相対座標を使用
        const worldX = tileWorldX !== undefined ? tileWorldX + x : x;
        const worldY = tileWorldY !== undefined ? tileWorldY + y : y;
        const bucket = Math.floor(elapsedTimeMs * jitterConfig.frequency);
        const noiseX = hashNoise(worldX, worldY, bucket);
        const noiseY = hashNoise(worldY, worldX, bucket + 1);
        coordDx = (noiseX * 2 - 1) * jitterConfig.amplitude;
        coordDy = (noiseY * 2 - 1) * jitterConfig.amplitude;
      }

      // 時間ベースの歪みと座標ベースのjitterを合成
      const dx = timeDx + coordDx;
      const dy = timeDy + coordDy;

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
