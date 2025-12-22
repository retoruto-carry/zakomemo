import type { StrokeSound, StrokeSoundInfo } from "../engine/ports";

/**
 * Web Audio APIを使用した描画音の動的生成
 *
 * 設計:
 * - 移動平均速度 = 直近の数サンプルの平均速度（滑らかな変化のため）
 * - 速度が低い場合は音量を0に（音は自然にフェードアウト）
 * - 速度に応じて音量と周波数を調整
 * - パラメータ更新をスロットルしてプツプツノイズを防止
 * - ノイズバッファを最適化してループノイズと遅延を削減
 * - exponentialRampToValueAtTimeでより滑らかな変化を実現
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

  // ノイズバッファを事前生成して書き始めの遅延を削減
  private noiseBuffers: Map<"pen" | "pattern" | "eraser", AudioBuffer | null> =
    new Map();

  // 移動平均速度計算用: 直近のサンプルを保持（滑らかな速度計算のため）
  private speedSamples: Array<{ length: number; time: number }> = [];
  private currentTool: "pen" | "pattern" | "eraser" | null = null;
  private smoothedSpeed = 0;

  // パラメータ更新のスロットル用（プツプツノイズ防止）
  private lastUpdateTime = 0;
  private pendingSpeed = 0;
  private updateScheduled = false;
  private updateTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // 書き始めの時間を記録（最初の一筆で音が出るようにするため）
  private strokeStartTime = 0;

  // イベントリスナーのクリーンアップ用
  private interactionHandlers: Array<{
    event: string;
    handler: () => void;
  }> = [];

  private static readonly MAX_SAMPLES = 8; // 移動平均のサンプル数（増加）
  private static readonly UPDATE_INTERVAL_MS = 16; // 約60fpsで更新（16ms間隔）
  private static readonly NOISE_BUFFER_DURATION = 0.3; // ノイズバッファの長さ（秒）- バッファ作成の遅延を最小化（0.3秒でもループノイズは発生しにくい）
  private static readonly SMOOTH_TIME = 0.2; // パラメータ変化のスムージング時間（秒）
  private static readonly FADE_IN_TIME = 0.03; // フェードイン時間（秒）- 書き始めの遅延を削減
  private static readonly FADE_IN_INITIAL_VOLUME = 0.3; // フェードイン時の初期音量
  private static readonly FADE_OUT_TIME = 0.05; // フェードアウト時間（秒）- 早めのフェードアウトでプツプツノイズを防止
  private static readonly INITIAL_SOUND_GUARANTEE_MS = 150; // 書き始めの音を保証する時間（ミリ秒）
  private static readonly INITIAL_MIN_VOLUME = 0.2; // 書き始めの最小音量
  private static readonly MIN_STOP_DELAY_MS = 60; // ノイズ停止の最小遅延時間（ミリ秒）

  constructor() {
    this.initializeAudioContext();
    // AudioContextを事前にresumeして書き始めの遅延を削減
    this.preloadAudioContext();
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
   * AudioContextを事前にresumeして書き始めの遅延を削減
   */
  private preloadAudioContext(): void {
    // ユーザーインタラクション後にAudioContextをresume
    const resumeContext = () => {
      if (this.audioContext?.state === "suspended") {
        this.audioContext.resume().catch(() => {
          // 無視
        });
      }
      // ノイズバッファを事前生成
      this.preloadNoiseBuffers();
    };

    // 既にユーザーインタラクションが発生している場合は即座に実行
    if (document.readyState === "complete") {
      resumeContext();
    } else {
      // ページロード後に実行
      window.addEventListener("load", resumeContext, { once: true });
    }

    // ユーザーインタラクション（クリック、タッチなど）でresume
    const events = ["mousedown", "touchstart", "pointerdown"];
    const handleInteraction = () => {
      resumeContext();
      events.forEach((event) => {
        document.removeEventListener(event, handleInteraction);
      });
      // クリーンアップリストから削除
      this.interactionHandlers = this.interactionHandlers.filter(
        (h) => h.handler !== handleInteraction,
      );
    };
    events.forEach((event) => {
      document.addEventListener(event, handleInteraction, { once: true });
      this.interactionHandlers.push({ event, handler: handleInteraction });
    });
  }

  /**
   * ノイズバッファを事前生成して書き始めの遅延を削減
   * 非同期でバックグラウンド生成し、メインスレッドをブロックしない
   */
  private preloadNoiseBuffers(): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    // 非同期でバックグラウンド生成（メインスレッドをブロックしない）
    // 最初の1つ（pen）は優先的に生成、残りはバックグラウンドで
    const generateBuffer = (
      tool: "pen" | "pattern" | "eraser",
      priority: boolean = false,
    ) => {
      if (this.noiseBuffers.has(tool)) return;

      const generate = () => {
        try {
          const buffer = this.createPinkNoiseBuffer(
            WebAudioStrokeSound.NOISE_BUFFER_DURATION,
            context.sampleRate,
          );
          this.noiseBuffers.set(tool, buffer);
        } catch {
          // エラーは無視
        }
      };

      if (priority) {
        // 優先（pen）は即座に生成
        generate();
      } else {
        // その他はバックグラウンドで生成（requestIdleCallbackまたはsetTimeout）
        if (typeof requestIdleCallback !== "undefined") {
          requestIdleCallback(generate, { timeout: 1000 });
        } else {
          setTimeout(generate, 0);
        }
      }
    };

    // penを優先的に生成、残りはバックグラウンドで
    generateBuffer("pen", true);
    generateBuffer("pattern", false);
    generateBuffer("eraser", false);
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
      // 非同期でresume（エラーは無視）
      this.audioContext.resume().catch(() => {
        // 無視
      });
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

    // ノイズバッファを取得（事前生成済みの場合はそれを使用、なければ生成）
    let buffer = this.noiseBuffers.get(tool);
    if (!buffer) {
      buffer = this.createPinkNoiseBuffer(
        WebAudioStrokeSound.NOISE_BUFFER_DURATION,
        context.sampleRate,
      );
      this.noiseBuffers.set(tool, buffer);
    }

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
   * 書き始めでも音が出るように、サンプルが少ない場合でも直近の2サンプルから速度を計算
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

    // サンプルが2つ未満の場合は、直近の2サンプルから速度を計算（書き始めでも音が出るように）
    if (this.speedSamples.length < 2) {
      return 0;
    }

    // 書き始めの場合は、直近の2サンプルから速度を計算（最初のサンプルがlength: 0でも正しく計算）
    if (this.speedSamples.length === 2) {
      const first = this.speedSamples[0];
      const last = this.speedSamples[1];
      const dt = last.time - first.time;
      const dx = last.length - first.length;

      if (dt <= 0) return 0;
      // 書き始めでも最小速度を保証
      const speed = dx / dt;
      return Math.max(speed, 0.05); // 最小速度0.05を保証
    }

    // サンプルが3つ以上の場合は、最初と最後のサンプルから速度を計算（移動平均）
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
   * exponentialRampToValueAtTimeを使用してより滑らかな変化を実現
   * 書き始めでも音が出るように、速度が0でも最小音量を保証
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

    const currentTime = context.currentTime;
    const smoothTime = WebAudioStrokeSound.SMOOTH_TIME;

    // 書き始めの一定時間は、速度に関係なく最小音量を保証（最初の一筆で音が出るように）
    const timeSinceStart = performance.now() - this.strokeStartTime;
    const isInitialPeriod =
      timeSinceStart < WebAudioStrokeSound.INITIAL_SOUND_GUARANTEE_MS;

    // 速度が閾値以下の場合
    if (speed <= 0.01) {
      // 書き始めの一定時間内は、速度が0でも最小音量を保証
      if (isInitialPeriod) {
        const minVolume = WebAudioStrokeSound.INITIAL_MIN_VOLUME;
        gainNode.gain.cancelScheduledValues(currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          Math.max(minVolume, 0.001),
          currentTime + smoothTime,
        );
        return;
      }
      // 書き始めの期間を過ぎた後は、完全に停止している場合のみ音量を0に
      const volume = 0;
      gainNode.gain.cancelScheduledValues(currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
      // exponentialRampToValueAtTimeでより滑らかなフェードアウト
      gainNode.gain.exponentialRampToValueAtTime(
        Math.max(volume, 0.001), // 0に近い値で指数カーブを適用
        currentTime + smoothTime,
      );
      return;
    }

    // 音量: 0.2 + speed * 0.6 (最大1.0)
    const volume = Math.min(0.2 + speed * 0.6, 1.0);
    gainNode.gain.cancelScheduledValues(currentTime);
    // exponentialRampToValueAtTimeは0から開始できないため、最小値0.001を保証
    gainNode.gain.setValueAtTime(
      Math.max(gainNode.gain.value, 0.001),
      currentTime,
    );
    // exponentialRampToValueAtTimeでより滑らかな変化
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(volume, 0.001),
      currentTime + smoothTime,
    );

    // 周波数: 基本周波数 * (0.9 + speed * 0.65) (平方根カーブ)
    const baseSettings = this.getFilterSettings(tool);
    const normalizedSpeed = Math.max(0.01, Math.min(speed, 2.0));
    const normalized = (normalizedSpeed - 0.01) / 1.99;
    const curveValue = Math.sqrt(normalized);
    const multiplier = 0.9 + curveValue * 1.3; // 0.9 ～ 2.2
    const targetFreq = baseSettings.frequency * multiplier;

    filterNode.frequency.cancelScheduledValues(currentTime);
    // exponentialRampToValueAtTimeは0から開始できないため、最小値20Hzを保証
    const currentFreq = filterNode.frequency.value;
    filterNode.frequency.setValueAtTime(Math.max(currentFreq, 20), currentTime);
    // exponentialRampToValueAtTimeでより滑らかな変化
    filterNode.frequency.exponentialRampToValueAtTime(
      Math.max(targetFreq, 20), // 20Hz以下は避ける
      currentTime + smoothTime,
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
    this.pendingSpeed = 0;
    this.updateScheduled = false;
    // 書き始めの時間を記録（最初の一筆で音が出るようにするため）
    const now = performance.now();
    this.lastUpdateTime = now;
    this.strokeStartTime = now;
    this.speedSamples.push({ length: info.length, time: now });

    // 他のツールの音を停止
    const currentTime = context.currentTime;
    for (const [tool, gainNode] of this.gainNodes) {
      if (tool !== info.tool) {
        gainNode.gain.cancelScheduledValues(currentTime);
        const currentGain = gainNode.gain.value;
        // exponentialRampToValueAtTimeは0から開始できないため、現在の値が0の場合は0.001から開始
        const startGain = currentGain > 0 ? currentGain : 0.001;
        gainNode.gain.setValueAtTime(startGain, currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.05);
      }
    }

    // ノイズを開始
    this.createAndPlayNoise(info.tool);

    // フェードイン（短い時間で即座に音が出るように）
    const gainNode = this.gainNodes.get(info.tool);
    if (gainNode) {
      gainNode.gain.cancelScheduledValues(currentTime);
      // 初期音量を少し上げて即座に音が出るようにする
      // exponentialRampToValueAtTimeは0から開始できないため、0.001から開始
      const initialVolume = WebAudioStrokeSound.FADE_IN_INITIAL_VOLUME;
      gainNode.gain.setValueAtTime(0.001, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        initialVolume,
        currentTime + WebAudioStrokeSound.FADE_IN_TIME,
      );
    }

    // 速度に応じた音量を即座に設定（書き始めでも音が出るように最小速度を保証）
    this.updateVolumeAndFrequency(info.tool, 0.1);
  }

  /**
   * ストローク更新時に呼ばれる
   * 移動平均速度を計算し、音量と周波数を更新（スロットル適用）
   * @param info ストローク情報
   */
  onStrokeUpdate(info: StrokeSoundInfo): void {
    const now = performance.now();
    this.smoothedSpeed = this.calculateSmoothedSpeed(info.length, now);
    this.pendingSpeed = this.smoothedSpeed;

    // スロットル: 前回の更新から一定時間経過していない場合はスキップ
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    if (timeSinceLastUpdate < WebAudioStrokeSound.UPDATE_INTERVAL_MS) {
      // スケジュールされていない場合のみスケジュール
      if (!this.updateScheduled) {
        this.updateScheduled = true;
        const delay =
          WebAudioStrokeSound.UPDATE_INTERVAL_MS - timeSinceLastUpdate;
        this.updateTimeoutId = setTimeout(() => {
          this.lastUpdateTime = performance.now();
          this.updateScheduled = false;
          this.updateTimeoutId = null;
          // ストロークが終了していない場合のみ更新
          if (this.currentTool) {
            this.updateVolumeAndFrequency(this.currentTool, this.pendingSpeed);
          }
        }, delay);
      }
      return;
    }

    // 即座に更新
    this.lastUpdateTime = now;
    if (this.currentTool) {
      this.updateVolumeAndFrequency(this.currentTool, this.smoothedSpeed);
    }
  }

  /**
   * ストローク終了時に呼ばれる
   * 早めのフェードアウトを適用し、プツプツノイズを防止
   * @param _info ストローク情報
   */
  onStrokeEnd(_info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    const tool = _info.tool;

    const gainNode = this.gainNodes.get(tool);
    if (!gainNode) return;

    const currentTime = context.currentTime;
    const fadeOutTime = WebAudioStrokeSound.FADE_OUT_TIME;

    // すべてのスケジュールされた音量変更をキャンセル
    gainNode.gain.cancelScheduledValues(currentTime);
    // 現在の音量から即座にフェードアウト開始
    // exponentialRampToValueAtTimeは0から開始できないため、最小値0.001を保証
    gainNode.gain.setValueAtTime(
      Math.max(gainNode.gain.value, 0.001),
      currentTime,
    );
    // exponentialRampToValueAtTimeで滑らかなフェードアウト（早めに）
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + fadeOutTime,
    );

    // フェードアウト完了後にノイズを停止（少し余裕を持たせる）
    const stopDelay = Math.max(
      fadeOutTime * 1000 + 10,
      WebAudioStrokeSound.MIN_STOP_DELAY_MS,
    );
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
      this.updateScheduled = false;
    }, stopDelay);
  }

  /**
   * リソースをクリーンアップする
   * すべてのノイズを停止し、オーディオノードを切断し、AudioContextを閉じる
   */
  destroy(): void {
    // スロットルされた更新コールバックをキャンセル
    if (this.updateTimeoutId !== null) {
      clearTimeout(this.updateTimeoutId);
      this.updateTimeoutId = null;
    }

    // イベントリスナーをクリーンアップ
    for (const { event, handler } of this.interactionHandlers) {
      document.removeEventListener(event, handler);
    }
    this.interactionHandlers = [];

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
