import type { StrokeSound, StrokeSoundInfo } from "../engine/ports";

/**
 * Web Audio APIを使用した描画音の動的生成
 * 
 * 設計:
 * - 移動平均速度 = 直近の数サンプルの平均速度（滑らかな変化のため）
 * - 速度が低い場合は音量を0に（音は自然にフェードアウト）
 * - 速度に応じて音量と周波数を調整
 */
export class WebAudioStrokeSound implements StrokeSound {
  private audioContext: AudioContext | null = null;
  private gainNodes: Map<"pen" | "pattern" | "eraser", GainNode> = new Map();
  private filterNodes: Map<
    "pen" | "pattern" | "eraser",
    BiquadFilterNode
  > = new Map();
  private noiseNodes: Map<
    "pen" | "pattern" | "eraser",
    AudioBufferSourceNode | null
  > = new Map();

  // 移動平均速度計算用: 直近のサンプルを保持（滑らかな速度計算のため）
  private speedSamples: Array<{ length: number; time: number }> = [];
  private currentTool: "pen" | "pattern" | "eraser" | null = null;
  private smoothedSpeed = 0;

  private static readonly MAX_SAMPLES = 5; // 移動平均のサンプル数

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext = new AudioContextClass();
    } catch {
      // AudioContext初期化失敗は無視
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      this.initializeAudioContext();
    }
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  private createPinkNoiseBuffer(
    duration: number,
    sampleRate: number,
  ): AudioBuffer {
    const context = this.ensureAudioContext();
    if (!context) throw new Error("AudioContext unavailable");

    const buffer = context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    let lpState = 0;
    const lpAlpha = 0.1;

    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      let pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      lpState = lpState * (1 - lpAlpha) + pink * lpAlpha;
      data[i] = lpState * 0.11;
    }

    return buffer;
  }

  private getFilterSettings(tool: "pen" | "pattern" | "eraser"): {
    type: BiquadFilterType;
    frequency: number;
    Q: number;
  } {
    switch (tool) {
      case "pen":
        return { type: "bandpass", frequency: 2800, Q: 0.8 };
      case "pattern":
        return { type: "bandpass", frequency: 2400, Q: 0.5 };
      case "eraser":
        return { type: "bandpass", frequency: 4000, Q: 0.7 };
    }
  }

  private createAndPlayNoise(tool: "pen" | "pattern" | "eraser"): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    // 既存ノイズを停止
    const existing = this.noiseNodes.get(tool);
    if (existing) {
      try {
        existing.stop();
      } catch {
        // 無視
      }
    }

    // ノードを取得または作成
    let gainNode = this.gainNodes.get(tool);
    let filterNode = this.filterNodes.get(tool);

    if (!gainNode) {
      gainNode = context.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(context.destination);
      this.gainNodes.set(tool, gainNode);
    }

    if (!filterNode) {
      filterNode = context.createBiquadFilter();
      const settings = this.getFilterSettings(tool);
      filterNode.type = settings.type;
      filterNode.frequency.value = settings.frequency;
      filterNode.Q.value = settings.Q;
      filterNode.connect(gainNode);
      this.filterNodes.set(tool, filterNode);
    }

    // ノイズバッファを作成（0.3秒ループ）
    const buffer = this.createPinkNoiseBuffer(0.3, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(filterNode);
    source.start(0);

    this.noiseNodes.set(tool, source);
  }

  private stopSound(tool: "pen" | "pattern" | "eraser"): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    const gainNode = this.gainNodes.get(tool);
    if (!gainNode) return;

    gainNode.gain.cancelScheduledValues(context.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.05);
  }


  /**
   * 移動平均速度を計算（滑らかな速度変化のため）
   * 直近の数サンプルの速度を平均化することで、急激な変動を防ぐ
   */
  private calculateSmoothedSpeed(
    currentLength: number,
    currentTime: number,
  ): number {
    // 新しいサンプルを追加
    this.speedSamples.push({ length: currentLength, time: currentTime });

    // 古いサンプルを削除（最大サンプル数を超える場合）
    if (this.speedSamples.length > WebAudioStrokeSound.MAX_SAMPLES) {
      this.speedSamples.shift();
    }

    // サンプルが2つ未満の場合は速度0
    if (this.speedSamples.length < 2) {
      return 0;
    }

    // 最初と最後のサンプルから速度を計算（移動平均）
    const first = this.speedSamples[0];
    const last = this.speedSamples[this.speedSamples.length - 1];
    const dt = last.time - first.time;
    const dx = last.length - first.length;

    if (dt <= 0) return 0;
    return dx / dt;
  }

  private updateVolumeAndFrequency(
    tool: "pen" | "pattern" | "eraser",
    speed: number,
  ): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    const gainNode = this.gainNodes.get(tool);
    const filterNode = this.filterNodes.get(tool);
    if (!gainNode || !filterNode) return;

    // 速度が閾値以下なら音量を0に（音は止めない、自然にフェードアウト）
    if (speed <= 0.01) {
      const volume = 0;
      gainNode.gain.cancelScheduledValues(context.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.1);
      return;
    }

    // 音量: 0.2 + speed * 0.6 (最大1.0)
    const volume = Math.min(0.2 + speed * 0.6, 1.0);
    gainNode.gain.cancelScheduledValues(context.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.1);

    // 周波数: 基本周波数 * (0.9 + speed * 0.65) (平方根カーブ)
    const baseSettings = this.getFilterSettings(tool);
    const normalizedSpeed = Math.max(0.01, Math.min(speed, 2.0));
    const normalized = (normalizedSpeed - 0.01) / 1.99;
    const curveValue = Math.sqrt(normalized);
    const multiplier = 0.9 + curveValue * 1.3; // 0.9 ～ 2.2
    const targetFreq = baseSettings.frequency * multiplier;

    filterNode.frequency.cancelScheduledValues(context.currentTime);
    filterNode.frequency.setValueAtTime(
      filterNode.frequency.value,
      context.currentTime,
    );
    filterNode.frequency.linearRampToValueAtTime(
      targetFreq,
      context.currentTime + 0.1,
    );
  }

  onStrokeStart(info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    this.currentTool = info.tool;
    this.speedSamples = [];
    this.smoothedSpeed = 0;
    const now = performance.now();
    this.speedSamples.push({ length: info.length, time: now });

    // 他のツールの音を停止
    for (const [tool, gainNode] of this.gainNodes) {
      if (tool !== info.tool) {
        gainNode.gain.cancelScheduledValues(context.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.05);
      }
    }

    // ノイズを開始
    this.createAndPlayNoise(info.tool);

    // フェードイン
    const gainNode = this.gainNodes.get(info.tool);
    if (gainNode) {
      gainNode.gain.cancelScheduledValues(context.currentTime);
      gainNode.gain.setValueAtTime(0, context.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.12);
    }

    this.updateVolumeAndFrequency(info.tool, 0.1);
  }

  onStrokeUpdate(info: StrokeSoundInfo): void {
    const now = performance.now();
    this.smoothedSpeed = this.calculateSmoothedSpeed(info.length, now);

    if (this.currentTool) {
      this.updateVolumeAndFrequency(this.currentTool, this.smoothedSpeed);
    }
  }

  onStrokeEnd(_info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    const tool = _info.tool;

    const gainNode = this.gainNodes.get(tool);
    if (!gainNode) return;

    gainNode.gain.cancelScheduledValues(context.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.18);

    setTimeout(() => {
      const noiseNode = this.noiseNodes.get(tool);
      if (noiseNode) {
        try {
          noiseNode.stop();
        } catch {
          // 無視
        }
        this.noiseNodes.set(tool, null);
      }
      this.speedSamples = [];
      this.smoothedSpeed = 0;
      this.currentTool = null;
    }, 200);
  }

  destroy(): void {

    for (const noiseNode of this.noiseNodes.values()) {
      if (noiseNode) {
        try {
          noiseNode.stop();
        } catch {
          // 無視
        }
      }
    }

    for (const gainNode of this.gainNodes.values()) {
      gainNode.disconnect();
    }
    for (const filterNode of this.filterNodes.values()) {
      filterNode.disconnect();
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
