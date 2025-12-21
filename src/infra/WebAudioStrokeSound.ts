import type { StrokeSound, StrokeSoundInfo } from "../engine/ports";

/**
 * Web Audio APIを使用した描画音の動的生成
 * 描画速度（瞬間速度）に応じて音色と音量をリアルタイムに変化させる
 * 
 * 設計方針:
 * - 瞬間速度 = 前回のonStrokeUpdateからの移動距離 / 経過時間
 * - onStrokeUpdateは1.5ピクセル以上移動したときのみ呼ばれる
 * - 停止判定: 最後のonStrokeUpdateから一定時間（80ms）経過したら停止
 * - 時間計測: performance.now()を統一して使用
 */
export class WebAudioStrokeSound implements StrokeSound {
  private audioContext: AudioContext | null = null;
  private gainNodes: Map<
    "pen" | "pattern" | "eraser",
    GainNode
  > = new Map();
  private filterNodes: Map<
    "pen" | "pattern" | "eraser",
    BiquadFilterNode
  > = new Map();
  private noiseNodes: Map<
    "pen" | "pattern" | "eraser",
    AudioBufferSourceNode | null
  > = new Map();
  private isPlaying: Map<"pen" | "pattern" | "eraser", boolean> = new Map();
  private currentTool: "pen" | "pattern" | "eraser" | null = null;
  
  // 瞬間速度計算用: 前回のonStrokeUpdateの情報のみを保持
  private lastStrokeLength: Map<
    "pen" | "pattern" | "eraser",
    number
  > = new Map();
  private lastUpdateTime: Map<
    "pen" | "pattern" | "eraser",
    number
  > = new Map(); // performance.now()で計測
  
  private checkInterval: number | null = null;
  
  // 停止判定の閾値
  private static readonly STOP_THRESHOLD_MS = 80; // 最後の更新から80ms経過で停止
  private static readonly STOP_DISTANCE_THRESHOLD = 0.5; // 停止判定: この距離以下なら停止とみなす（ピクセル）
  private static readonly SPEED_THRESHOLD = 0.01; // ピクセル/ミリ秒

  constructor() {
    // AudioContextの初期化（ユーザー操作後に実行される可能性があるため、遅延初期化）
    this.initializeAudioContext();
    
    // 定期的に停止判定をチェック（50msごと）
    this.checkInterval = window.setInterval(() => {
      this.checkAndStopIfNeeded();
    }, 50);
  }

  private initializeAudioContext(): void {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("Web Audio API is not supported");
        return;
      }
      this.audioContext = new AudioContextClass();
    } catch (error) {
      console.warn("Failed to initialize AudioContext:", error);
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      this.initializeAudioContext();
    }
    // AudioContextがサスペンドされている場合は再開
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * ホワイトノイズを生成するAudioBufferを作成
   */
  private createWhiteNoiseBuffer(
    duration: number,
    sampleRate: number,
  ): AudioBuffer {
    const context = this.ensureAudioContext();
    if (!context) {
      throw new Error("AudioContext is not available");
    }

    const buffer = context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      // ホワイトノイズ: -1.0 から 1.0 の間のランダムな値
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  /**
   * ピンクノイズを生成するAudioBufferを作成
   * ピンクノイズはより自然な音色を持つ
   * より滑らかな音にするため、追加のローパスフィルターを適用
   */
  private createPinkNoiseBuffer(
    duration: number,
    sampleRate: number,
  ): AudioBuffer {
    const context = this.ensureAudioContext();
    if (!context) {
      throw new Error("AudioContext is not available");
    }

    const buffer = context.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    // ピンクノイズ生成用のフィルター状態
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    // 追加のローパスフィルター用の状態（より滑らかな音にするため）
    let lpState = 0;
    const lpAlpha = 0.1; // ローパスフィルターの係数（小さいほど滑らか）

    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;

      // ピンクノイズフィルター（Paul Kellet's method）
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      let pink =
        b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;

      // 追加のローパスフィルターでより滑らかに（ゆっくり動かしたときの機械的な音を軽減）
      lpState = lpState * (1 - lpAlpha) + pink * lpAlpha;
      pink = lpState;

      data[i] = pink * 0.11; // 音量調整
    }

    return buffer;
  }

  /**
   * ツールごとのノイズタイプを取得
   */
  private getNoiseTypeForTool(
    tool: "pen" | "pattern" | "eraser",
  ): "white" | "pink" {
    switch (tool) {
      case "pen":
        return "pink"; // ペンはピンクノイズ（より自然な筆記音）
      case "pattern":
        return "pink"; // ブラシもピンクノイズ（柔らかい音）
      case "eraser":
        return "pink"; // 消しゴムもピンクノイズ（より自然な消去音）
    }
  }

  /**
   * ツールごとの基本フィルター設定を取得
   */
  private getFilterSettingsForTool(tool: "pen" | "pattern" | "eraser"): {
    type: BiquadFilterType;
    frequency: number;
    Q: number;
  } {
    switch (tool) {
      case "pen":
        return {
          type: "bandpass",
          frequency: 2800, // 中音域（周波数を上げて音程を高く）
          Q: 0.8, // Qを下げてより滑らかに（機械的な音を軽減）
        };
      case "pattern":
        return {
          type: "lowpass",
          frequency: 1200, // 低音域（柔らかいブラシ音）- 周波数を上げて音程を高く
          Q: 0.2, // Qをさらに下げてより滑らかに（機械的な音を軽減）
        };
      case "eraser":
        return {
          type: "bandpass",
          frequency: 3200, // 中高音域（自然な消去音）- 周波数を上げて音程を高く
          Q: 0.7, // Qをさらに下げてより滑らかに（機械的な音を軽減）
        };
    }
  }

  /**
   * ノイズソースを作成して再生
   */
  private createAndPlayNoise(tool: "pen" | "pattern" | "eraser"): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    // 既存のノイズを停止
    const existingNoise = this.noiseNodes.get(tool);
    if (existingNoise) {
      try {
        existingNoise.stop();
      } catch {
        // 既に停止している場合は無視
      }
    }

    // GainNodeとFilterNodeを取得または作成
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
      const settings = this.getFilterSettingsForTool(tool);
      filterNode.type = settings.type;
      filterNode.frequency.value = settings.frequency;
      filterNode.Q.value = settings.Q;
      filterNode.connect(gainNode);
      this.filterNodes.set(tool, filterNode);
    }

    // ノイズバッファを作成（0.3秒のループ - より長くしてシームレスに）
    const noiseType = this.getNoiseTypeForTool(tool);
    const buffer =
      noiseType === "pink"
        ? this.createPinkNoiseBuffer(0.3, context.sampleRate)
        : this.createWhiteNoiseBuffer(0.3, context.sampleRate);

    // AudioBufferSourceNodeを作成
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(filterNode);

    // 再生開始
    source.start(0);
    this.noiseNodes.set(tool, source);
    this.isPlaying.set(tool, true);
  }

  onStrokeStart(info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    this.currentTool = info.tool;

    // 更新情報をリセット（直近の更新情報のみを保持）
    const now = performance.now();
    this.lastStrokeLength.set(info.tool, info.length);
    this.lastUpdateTime.set(info.tool, now);

    // 他のツールの音をフェードアウト
    for (const [tool, gainNode] of this.gainNodes) {
      if (tool !== info.tool && this.isPlaying.get(tool)) {
        gainNode.gain.cancelScheduledValues(context.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.05);
        this.isPlaying.set(tool, false);
      }
    }

    // 現在のツールのノイズを開始
    this.createAndPlayNoise(info.tool);

    // フェードイン
    const gainNode = this.gainNodes.get(info.tool);
    if (gainNode) {
      gainNode.gain.cancelScheduledValues(context.currentTime);
      gainNode.gain.setValueAtTime(0, context.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.12);
    }

    this.updateSound(info);
  }

  onStrokeUpdate(info: StrokeSoundInfo): void {
    this.updateSound(info);
  }

  onStrokeEnd(_info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    const tool = _info.tool;
    
    const gainNode = this.gainNodes.get(tool);
    if (!gainNode) return;

    // フェードアウト
    gainNode.gain.cancelScheduledValues(context.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.18);

    // 停止
    setTimeout(() => {
      const noiseNode = this.noiseNodes.get(tool);
      if (noiseNode) {
        try {
          noiseNode.stop();
        } catch {
          // 既に停止している場合は無視
        }
        this.noiseNodes.set(tool, null);
      }
      this.isPlaying.set(tool, false);
      // 更新情報をクリア
      this.lastUpdateTime.delete(tool);
      this.lastStrokeLength.delete(tool);
    }, 200);
  }

  /**
   * 定期的にチェックして、停止すべき場合は音を止める
   * onStrokeUpdateは1.5ピクセル以上移動したときのみ呼ばれるため、
   * 停止時は呼ばれない。そのため、定期的にチェックして停止判定を行う。
   * 
   * 停止判定:
   * - 最後のonStrokeUpdateからSTOP_THRESHOLD_MS以上経過している
   * - かつ、その間の移動距離がSTOP_DISTANCE_THRESHOLD以下
   * 人間の指は完全に静止することが難しく、微細な動きがあるため、距離の閾値も必要
   */
  private checkAndStopIfNeeded(): void {
    const now = performance.now();
    
    for (const tool of ["pen", "pattern", "eraser"] as const) {
      if (!this.isPlaying.get(tool)) continue;
      
      const lastUpdate = this.lastUpdateTime.get(tool);
      const lastLength = this.lastStrokeLength.get(tool);
      if (lastUpdate === undefined || lastLength === undefined) continue;
      
      // 最後のonStrokeUpdateからの経過時間
      const timeSinceLastUpdate = now - lastUpdate;
      
      // 時間閾値を超えている場合は停止（距離は考慮しない、onStrokeUpdateが呼ばれないため）
      if (timeSinceLastUpdate > WebAudioStrokeSound.STOP_THRESHOLD_MS) {
        this.stopSound(tool);
        this.isPlaying.set(tool, false);
      }
    }
  }

  /**
   * 音を停止する（フェードアウト）
   */
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
   * 描画速度に応じて音色と音量を更新
   * 設計:
   * - 瞬間速度 = 前回のonStrokeUpdateからの移動距離 / 経過時間
   * - onStrokeUpdateは1.5ピクセル以上移動したときのみ呼ばれる
   * - 停止判定はcheckAndStopIfNeededで行う
   */
  private updateSound(info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    const gainNode = this.gainNodes.get(info.tool);
    const filterNode = this.filterNodes.get(info.tool);
    if (!gainNode || !filterNode) return;

    const now = performance.now();
    const lastLength = this.lastStrokeLength.get(info.tool);
    const lastUpdateTime = this.lastUpdateTime.get(info.tool);

    // 瞬間速度を計算: 前回のonStrokeUpdateからの距離と時間のみを使用
    let instantaneousSpeed = 0;

    if (lastLength !== undefined && lastUpdateTime !== undefined) {
      const timeSinceLastUpdate = now - lastUpdateTime;
      const distanceSinceLastUpdate = info.length - lastLength;

      // 停止判定: 時間閾値と距離閾値の両方をチェック
      // 人間の指は完全に静止することが難しく、微細な動きがあるため、距離の閾値も必要
      if (
        timeSinceLastUpdate > WebAudioStrokeSound.STOP_THRESHOLD_MS &&
        distanceSinceLastUpdate <= WebAudioStrokeSound.STOP_DISTANCE_THRESHOLD
      ) {
        // 停止中: 時間が経過しているが、移動距離が非常に小さい
        instantaneousSpeed = 0;
      } else if (timeSinceLastUpdate > 0) {
        // 瞬間速度 = 前回のonStrokeUpdateからの移動距離 / 経過時間
        instantaneousSpeed = distanceSinceLastUpdate / timeSinceLastUpdate;
      } else {
        instantaneousSpeed = 0;
      }
    } else {
      // 初回更新時は累積速度を使用（フォールバック）
      instantaneousSpeed = info.speed;
    }

    // 瞬間速度が閾値以下の場合は音を出さない（静止時は無音）
    if (instantaneousSpeed <= WebAudioStrokeSound.SPEED_THRESHOLD) {
      this.stopSound(info.tool);
      // 更新情報は保持（checkAndStopIfNeededで確実に停止）
      return;
    }

    // 更新情報を保存（直近の情報のみ）
    this.lastStrokeLength.set(info.tool, info.length);
    this.lastUpdateTime.set(info.tool, now);

    // 瞬間速度に基づいて音量を調整（0.1 ～ 1.0）
    const baseVolume = 0.1;
    const speedVolume = Math.min(instantaneousSpeed * 0.5, 0.9);
    const targetVolume = baseVolume + speedVolume;

    // 音量をスムーズに変更（より長い時間で変化させて滑らかに）
    gainNode.gain.cancelScheduledValues(context.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      targetVolume,
      context.currentTime + 0.1, // 0.05秒から0.1秒に延長してより滑らかに
    );

    // 瞬間速度に基づいてフィルター周波数を調整（より速い描画で高音域を強調）
    // お絵かきソフトのベストプラクティス: ゆっくり動かしているときでも適切な周波数を保つ
    const baseSettings = this.getFilterSettingsForTool(info.tool);
    
    // 瞬間速度を正規化（0.01～2.0の範囲を想定）
    const normalizedSpeed = Math.max(0.01, Math.min(instantaneousSpeed, 2.0));
    
    // 平方根カーブで周波数を計算（ゆっくり動かしているときは緩やかに変化、速いときは大きく変化）
    // 下限: 0.9倍（ゆっくり動かしているときでも基本周波数の90%を保つ）
    // 上限: 2.2倍（速く動かしているときは2.2倍まで）
    const minMultiplier = 0.9;
    const maxMultiplier = 2.2;
    
    // 速度を0～1の範囲に正規化
    const speedRange = 2.0 - 0.01;
    const normalized = (normalizedSpeed - 0.01) / speedRange;
    
    // 平方根カーブでマッピング（ゆっくり動かしているときは緩やかに変化）
    const curveValue = Math.sqrt(normalized);
    
    // 周波数倍率を計算
    const speedMultiplier = minMultiplier + (maxMultiplier - minMultiplier) * curveValue;
    
    const targetFrequency = baseSettings.frequency * speedMultiplier;

    // 周波数をスムーズに変更（より長い時間で変化させて滑らかに）
    filterNode.frequency.cancelScheduledValues(context.currentTime);
    filterNode.frequency.setValueAtTime(
      filterNode.frequency.value,
      context.currentTime,
    );
    filterNode.frequency.linearRampToValueAtTime(
      targetFrequency,
      context.currentTime + 0.1, // 0.05秒から0.1秒に延長してより滑らかに
    );
  }

  /**
   * クリーンアップ（必要に応じて）
   */
  destroy(): void {
    // チェックインターバルをクリア
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // すべてのノイズを停止
    for (const [tool, noiseNode] of this.noiseNodes) {
      if (noiseNode) {
        try {
          noiseNode.stop();
        } catch {
          // 既に停止している場合は無視
        }
      }
    }

    // ノードを切断
    for (const gainNode of this.gainNodes.values()) {
      gainNode.disconnect();
    }
    for (const filterNode of this.filterNodes.values()) {
      filterNode.disconnect();
    }

    // AudioContextを閉じる
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
