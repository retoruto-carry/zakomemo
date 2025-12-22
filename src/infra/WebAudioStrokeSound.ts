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
  private filterNodes: Map<"pen" | "pattern" | "eraser", BiquadFilterNode> =
    new Map();
  // 超高音域を絞るための追加ローパスフィルター（プツプツノイズ抑制）
  private lowpassNodes: Map<"pen" | "pattern" | "eraser", BiquadFilterNode> =
    new Map();
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

  /**
   * AudioContextを初期化する
   * ブラウザの互換性を考慮して、webkitAudioContextにも対応
   */
  private initializeAudioContext(): void {
    try {
      // Safari互換性のためwebkitAudioContextもチェック
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext = new AudioContextClass();
    } catch {
      // AudioContext初期化失敗は無視
    }
  }

  /**
   * AudioContextを取得し、必要に応じて初期化・再開する
   * @returns AudioContext、または利用できない場合はnull
   */
  private ensureAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      this.initializeAudioContext();
    }
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * ピンクノイズのAudioBufferを生成する
   * 2段階のローパスフィルターでプツプツノイズを抑制
   * @param duration バッファの長さ（秒）
   * @param sampleRate サンプルレート
   * @returns ピンクノイズのAudioBuffer
   */
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
    // 複数のローパスフィルターでより滑らかに（プツプツノイズを抑制）
    let lpState1 = 0;
    let lpState2 = 0;
    const lpAlpha1 = 0.15; // 第1段階のスムージング
    const lpAlpha2 = 0.2; // 第2段階のスムージング（より強力）

    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      // 2段階のローパスフィルターでプツプツノイズを抑制
      lpState1 = lpState1 * (1 - lpAlpha1) + pink * lpAlpha1;
      lpState2 = lpState2 * (1 - lpAlpha2) + lpState1 * lpAlpha2;
      data[i] = lpState2 * 0.11;
    }

    return buffer;
  }

  /**
   * ツールごとのフィルター設定を取得する
   * @param tool ツールの種類
   * @returns フィルターの設定（タイプ、周波数、Q値）
   */
  private getFilterSettings(tool: "pen" | "pattern" | "eraser"): {
    type: BiquadFilterType;
    frequency: number;
    Q: number;
  } {
    switch (tool) {
      case "pen":
        return { type: "bandpass", frequency: 2800, Q: 0.6 };
      case "pattern":
        return { type: "bandpass", frequency: 2400, Q: 0.4 };
      case "eraser":
        return { type: "bandpass", frequency: 4000, Q: 0.5 };
    }
  }

  /**
   * ノイズを生成して再生する
   * フィルターチェーン（bandpass → lowpass → gain）を構築し、ピンクノイズをループ再生
   * @param tool ツールの種類
   */
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
    let lowpassNode = this.lowpassNodes.get(tool);

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
      this.filterNodes.set(tool, filterNode);
    }

    // 超高音域を絞る追加ローパスフィルター（プツプツノイズ抑制）
    if (!lowpassNode) {
      lowpassNode = context.createBiquadFilter();
      lowpassNode.type = "lowpass";
      lowpassNode.frequency.value = 8000; // 8kHz以上をカット（超高音域を絞る）
      lowpassNode.Q.value = 0.7; // 滑らかなカットオフ
      lowpassNode.connect(gainNode);
      this.lowpassNodes.set(tool, lowpassNode);
    }

    // フィルターチェーン: source -> filterNode -> lowpassNode -> gainNode
    filterNode.connect(lowpassNode);

    // ノイズバッファを作成（0.3秒ループ）
    const buffer = this.createPinkNoiseBuffer(0.3, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(filterNode);
    source.start(0);

    this.noiseNodes.set(tool, source);
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

  /**
   * 音量と周波数を速度に応じて更新する
   * 速度が閾値以下の場合は音量を0にし、それ以外は速度に応じて音量と周波数を調整
   * @param tool ツールの種類
   * @param speed 描画速度（ピクセル/ミリ秒）
   */
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

  /**
   * ストローク開始時に呼ばれる
   * ノイズを生成して再生を開始し、フェードインを適用
   * @param info ストローク情報
   */
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

  /**
   * ストローク更新時に呼ばれる
   * 移動平均速度を計算し、音量と周波数を更新
   * @param info ストローク情報
   */
  onStrokeUpdate(info: StrokeSoundInfo): void {
    const now = performance.now();
    this.smoothedSpeed = this.calculateSmoothedSpeed(info.length, now);

    if (this.currentTool) {
      this.updateVolumeAndFrequency(this.currentTool, this.smoothedSpeed);
    }
  }

  /**
   * ストローク終了時に呼ばれる
   * フェードアウトを適用し、一定時間後にノイズを停止
   * @param _info ストローク情報
   */
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

  /**
   * リソースをクリーンアップする
   * すべてのノイズを停止し、オーディオノードを切断し、AudioContextを閉じる
   */
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
    for (const lowpassNode of this.lowpassNodes.values()) {
      lowpassNode.disconnect();
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
