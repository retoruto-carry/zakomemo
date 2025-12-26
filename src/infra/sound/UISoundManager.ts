import { Howl } from "howler";

/** UI効果音の再生オプション */
export interface PlayOptions {
  volume?: number;
  rate?: number;
  stopPrevious?: boolean;
}

/**
 * UI要素用の音源管理システム
 * Howler.jsを使用して複数の音源を管理し、再生を制御する
 */
export class UISoundManager {
  private sounds: Map<string, Howl> = new Map();
  private playingSounds: Set<string> = new Set();
  private defaultVolume: number = 0.5;
  private maxConcurrentSounds: number = 5;

  /**
   * 既に登録されている場合は破棄して再登録
   */
  registerSound(
    id: string,
    src: string | string[],
    options?: {
      volume?: number;
      preload?: boolean;
    },
  ): void {
    if (this.sounds.has(id)) {
      // 既に登録されている場合は破棄して再登録
      this.sounds.get(id)?.unload();
    }

    const howl = new Howl({
      src: Array.isArray(src) ? src : [src],
      volume: options?.volume ?? this.defaultVolume,
      preload: options?.preload ?? true,
    });

    this.sounds.set(id, howl);
  }

  /**
   * @returns 再生ID（停止時に使用）
   */
  play(id: string, options?: PlayOptions): number | null {
    const sound = this.sounds.get(id);
    if (!sound) {
      console.warn(`Sound "${id}" is not registered`);
      return null;
    }

    // 同時再生数の制限
    if (this.playingSounds.size >= this.maxConcurrentSounds) {
      // 最も古い音を停止
      const oldestId = Array.from(this.playingSounds)[0];
      this.stop(oldestId);
    }

    // 前の音を停止するオプション
    if (options?.stopPrevious) {
      this.stop(id);
    }

    // ボリュームとレートを設定
    if (options?.volume !== undefined) {
      sound.volume(options.volume);
    }
    if (options?.rate !== undefined) {
      sound.rate(options.rate);
    }

    // 再生
    const soundId = sound.play();
    this.playingSounds.add(id);

    // 再生終了時にplayingSoundsから削除
    sound.once("end", () => {
      this.playingSounds.delete(id);
    });

    return soundId;
  }

  stop(id: string): void {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.stop();
      this.playingSounds.delete(id);
    }
  }

  stopAll(): void {
    for (const [id] of this.sounds) {
      this.stop(id);
    }
  }

  unregister(id: string): void {
    this.stop(id);
    const sound = this.sounds.get(id);
    if (sound) {
      sound.unload();
      this.sounds.delete(id);
    }
  }

  unregisterAll(): void {
    for (const [id] of this.sounds) {
      this.unregister(id);
    }
  }

  setDefaultVolume(volume: number): void {
    this.defaultVolume = Math.max(0, Math.min(1, volume));
  }

  setMaxConcurrentSounds(max: number): void {
    this.maxConcurrentSounds = Math.max(1, max);
  }
}
