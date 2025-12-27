import type { StrokeSound, StrokeSoundInfo } from "@/engine/ports";

type ToolId = "pen" | "pattern" | "eraser";

type ToolProfile = {
  bandpassFrequency: number;
  bandpassQ: number;
  lowpassFrequency: number;
  highpassFrequency: number;
  minGain: number;
  gainScale: number;
  freqMinMultiplier: number;
  freqMaxMultiplier: number;
};

type ToolState = {
  profile: ToolProfile;
  gain: GainNode;
  bandpass: BiquadFilterNode;
  lowpass: BiquadFilterNode;
  highpass: BiquadFilterNode;
  source: AudioBufferSourceNode | AudioWorkletNode | null;
  sourceKind: "buffer" | "worklet" | null;
  smoothSpeed: number;
  lastUpdateAt: number;
  lastLength: number;
  lastTimeSinceStart: number;
  lastInputAt: number;
  // ゲートを使って「ほぼ停止中」のノイズを確実に無音化する
  gateOpen: boolean;
  // ゲートを閉じる前のホールド期限（チラつきを防止）
  gateHoldUntil: number;
  strokeActive: boolean;
  idleTimeoutId: ReturnType<typeof setTimeout> | null;
  stopTimeoutId: ReturnType<typeof setTimeout> | null;
};

/**
 * Web Audio APIを使った描画音の実装（安定したノイズ生成・スムージング重視）
 */
export class WebAudioStrokeSound implements StrokeSound {
  private audioContext: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private toolStates: Map<ToolId, ToolState> = new Map();
  private interactionHandlers: Array<{
    event: string;
    handler: () => void;
  }> = [];
  // AudioWorkletは動的生成し、環境未対応ならバッファループにフォールバック
  private workletUrl: string | null = null;
  private workletLoaded = false;
  private workletLoadPromise: Promise<void> | null = null;

  private static readonly TOOL_PROFILES: Record<ToolId, ToolProfile> = {
    pen: {
      bandpassFrequency: 2800,
      bandpassQ: 0.6,
      lowpassFrequency: 8000,
      highpassFrequency: 60,
      minGain: 0.12,
      gainScale: 0.25,
      freqMinMultiplier: 0.9,
      freqMaxMultiplier: 2.1,
    },
    pattern: {
      bandpassFrequency: 2400,
      bandpassQ: 0.4,
      lowpassFrequency: 8000,
      highpassFrequency: 60,
      minGain: 0.12,
      gainScale: 0.22,
      freqMinMultiplier: 0.9,
      freqMaxMultiplier: 1.9,
    },
    eraser: {
      bandpassFrequency: 4000,
      bandpassQ: 0.5,
      lowpassFrequency: 8000,
      highpassFrequency: 90,
      minGain: 0.1,
      gainScale: 0.2,
      freqMinMultiplier: 0.9,
      freqMaxMultiplier: 2.1,
    },
  };

  private static readonly NOISE_DURATION_SEC = 8;
  private static readonly LOOP_CROSSFADE_SEC = 0.05;
  private static readonly NOISE_GAIN = 0.22;
  private static readonly SPEED_REFERENCE = 1.2;
  // GATE系は「ほぼ停止中」を判定して音を素早く止めるための閾値/タイミング
  private static readonly GATE_ON_SPEED = 0.004;
  private static readonly GATE_OFF_SPEED = 0.004;
  private static readonly GATE_HOLD_MS = 60;
  // 指が離れるまで音を切らないモード（停止時はminGainまで下げる）
  private static readonly ALWAYS_SOUND_WHILE_DRAWING = true;
  // 書き始めの極小移動は「始点保持」として音を維持する
  private static readonly INITIAL_HOLD_LENGTH_PX = 2;
  private static readonly SPEED_SMOOTH_SEC = 0.08;
  private static readonly PARAM_SMOOTH_SEC = 0.06;
  // ゲートが閉じた瞬間の素早いフェードアウト
  private static readonly GATE_RELEASE_SEC = 0.01;
  private static readonly ATTACK_SEC = 0.02;
  private static readonly RELEASE_SEC = 0.05;
  private static readonly SWITCH_RELEASE_SEC = 0.05;
  private static readonly INITIAL_GUARANTEE_MS = 140;
  // pointermoveが止まった時の強制無音化までの時間
  private static readonly IDLE_TIMEOUT_MS = 55;
  private static readonly STOP_AFTER_IDLE_MS = 220;

  constructor() {
    this.initializeAudioContext();
    this.setupInteractionResume();
  }

  /**
   * ストローク開始時に呼ばれる。
   * ノイズソースを起動し、初期ゲインを設定して描画音を立ち上げる。
   */
  onStrokeStart(info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;

    const tool = info.tool;
    this.fadeOutOtherTools(tool);

    const state = this.ensureToolState(tool, context);
    this.cancelStop(state);
    this.ensureNoiseSource(state, context);

    this.resetStrokeState(state, info, context);

    const initialGain = state.profile.minGain;
    this.scheduleGain(state, initialGain, WebAudioStrokeSound.ATTACK_SEC);
    this.applySpeed(info, state, context, true);
  }

  /**
   * ストローク更新時に呼ばれる。
   * 速度に応じてゲインとフィルター周波数を更新する。
   */
  onStrokeUpdate(info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;
    const state = this.toolStates.get(info.tool);
    if (!state) return;
    const instantSpeed = this.calculateInstantSpeed(info, state);
    this.refreshInputState(state, info, context);
    this.applySpeed(info, state, context, false, instantSpeed);
  }

  /**
   * ストローク終了時に呼ばれる。
   * フェードアウト後にノイズソースを停止する。
   */
  onStrokeEnd(info: StrokeSoundInfo): void {
    const context = this.ensureAudioContext();
    if (!context) return;
    const state = this.toolStates.get(info.tool);
    if (!state) return;

    state.strokeActive = false;
    this.clearIdleCheck(state);
    this.scheduleGain(state, 0, WebAudioStrokeSound.RELEASE_SEC);
    this.scheduleStop(state, WebAudioStrokeSound.STOP_AFTER_IDLE_MS);
  }

  private fadeOutOtherTools(activeTool: ToolId): void {
    for (const [tool, state] of this.toolStates) {
      if (tool !== activeTool) {
        this.scheduleGain(state, 0, WebAudioStrokeSound.SWITCH_RELEASE_SEC);
      }
    }
  }

  private resetStrokeState(
    state: ToolState,
    info: StrokeSoundInfo,
    context: AudioContext,
  ): void {
    state.smoothSpeed = 0;
    state.lastUpdateAt = context.currentTime;
    state.gateOpen = true;
    state.gateHoldUntil =
      context.currentTime + WebAudioStrokeSound.INITIAL_GUARANTEE_MS / 1000;
    state.strokeActive = true;
    this.refreshInputState(state, info, context);
  }

  private refreshInputState(
    state: ToolState,
    info: StrokeSoundInfo,
    context: AudioContext,
  ): void {
    state.lastLength = info.length;
    state.lastTimeSinceStart = info.timeSinceStart;
    state.lastInputAt = context.currentTime;
    this.scheduleIdleCheck(state, context);
  }

  /**
   * リソースをクリーンアップする。
   * ノードとタイマーを停止し、AudioContextを閉じる。
   */
  destroy(): void {
    for (const { event, handler } of this.interactionHandlers) {
      document.removeEventListener(event, handler);
    }
    this.interactionHandlers = [];

    for (const state of this.toolStates.values()) {
      if (state.stopTimeoutId !== null) {
        clearTimeout(state.stopTimeoutId);
      }
      if (state.idleTimeoutId !== null) {
        clearTimeout(state.idleTimeoutId);
      }
      if (state.source) {
        if (this.isBufferSource(state.source)) {
          try {
            state.source.stop();
          } catch {
            // 無視
          }
        }
        state.source.disconnect();
        state.source = null;
        state.sourceKind = null;
      }
      state.highpass.disconnect();
      state.bandpass.disconnect();
      state.lowpass.disconnect();
      state.gain.disconnect();
    }
    this.toolStates.clear();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.noiseBuffer = null;
    this.workletLoaded = false;
    this.workletLoadPromise = null;

    if (this.workletUrl && typeof URL !== "undefined") {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }
  }

  private initializeAudioContext(): void {
    if (this.audioContext) return;
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext = new AudioContextClass({ latencyHint: "interactive" });
    } catch {
      // AudioContext初期化失敗は無視
    }
  }

  private setupInteractionResume(): void {
    if (typeof window === "undefined") return;

    const resume = () => {
      const context = this.ensureAudioContext();
      if (!context) return;
      if (context.state === "suspended") {
        context.resume().catch(() => {
          // 無視
        });
      }
      this.preloadWorklet(context);
      if (!context.audioWorklet) {
        this.ensureNoiseBuffer(context);
      }
    };

    if (document.readyState === "complete") {
      resume();
    } else {
      window.addEventListener("load", resume, { once: true });
    }

    const events = ["pointerdown", "touchstart", "mousedown"];
    const handler = () => {
      resume();
      this.interactionHandlers = this.interactionHandlers.filter(
        (item) => item.handler !== handler,
      );
    };

    for (const event of events) {
      document.addEventListener(event, handler, { once: true });
      this.interactionHandlers.push({ event, handler });
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      this.initializeAudioContext();
    }
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume().catch(() => {
        // 無視
      });
    }
    return this.audioContext;
  }

  private ensureNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    this.noiseBuffer = this.createPinkNoiseBuffer(
      WebAudioStrokeSound.NOISE_DURATION_SEC,
      context,
    );
    return this.noiseBuffer;
  }

  private ensureToolState(tool: ToolId, context: AudioContext): ToolState {
    const existing = this.toolStates.get(tool);
    if (existing) return existing;

    const profile = WebAudioStrokeSound.TOOL_PROFILES[tool];

    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);

    const bandpass = context.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = profile.bandpassFrequency;
    bandpass.Q.value = profile.bandpassQ;

    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = profile.lowpassFrequency;
    lowpass.Q.value = 0.7;

    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = profile.highpassFrequency;
    highpass.Q.value = 0.4;

    highpass.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(gain);

    const state: ToolState = {
      profile,
      gain,
      bandpass,
      lowpass,
      highpass,
      source: null,
      sourceKind: null,
      smoothSpeed: 0,
      lastUpdateAt: context.currentTime,
      lastLength: 0,
      lastTimeSinceStart: 0,
      lastInputAt: context.currentTime,
      gateOpen: false,
      gateHoldUntil: 0,
      strokeActive: false,
      idleTimeoutId: null,
      stopTimeoutId: null,
    };
    this.toolStates.set(tool, state);
    return state;
  }

  private ensureNoiseSource(state: ToolState, context: AudioContext): void {
    if (state.source) return;
    this.preloadWorklet(context);
    if (this.workletLoaded && context.audioWorklet) {
      const node = new AudioWorkletNode(context, "pink-noise-processor", {
        outputChannelCount: [1],
      });
      node.connect(state.highpass);
      state.source = node;
      state.sourceKind = "worklet";
      return;
    }

    const buffer = this.ensureNoiseBuffer(context);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    source.connect(state.highpass);
    source.start();
    state.source = source;
    state.sourceKind = "buffer";
  }

  private createPinkNoiseBuffer(
    duration: number,
    context: AudioContext,
  ): AudioBuffer {
    const length = Math.floor(duration * context.sampleRate);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

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
      data[i] = pink * WebAudioStrokeSound.NOISE_GAIN;
    }

    this.applyLoopCrossfade(
      data,
      Math.min(
        Math.floor(WebAudioStrokeSound.LOOP_CROSSFADE_SEC * context.sampleRate),
        Math.floor(data.length / 2),
      ),
    );

    return buffer;
  }

  private applyLoopCrossfade(data: Float32Array, fadeSamples: number): void {
    if (fadeSamples <= 0) return;
    const tailStart = data.length - fadeSamples;
    for (let i = 0; i < fadeSamples; i++) {
      const fadeIn = i / fadeSamples;
      const fadeOut = 1 - fadeIn;
      const head = data[i];
      const tail = data[tailStart + i];
      data[i] = head * fadeIn + tail * fadeOut;
      data[tailStart + i] = tail * fadeIn + head * fadeOut;
    }
  }

  private applySpeed(
    info: StrokeSoundInfo,
    state: ToolState,
    context: AudioContext,
    forceInitial: boolean,
    overrideSpeed?: number,
  ): void {
    const profile = state.profile;
    const now = context.currentTime;
    const speed = overrideSpeed ?? info.speed;

    const dt = Math.max(0, now - state.lastUpdateAt);
    const speedBlend = 1 - Math.exp(-dt / WebAudioStrokeSound.SPEED_SMOOTH_SEC);
    state.smoothSpeed += (speed - state.smoothSpeed) * speedBlend;
    state.lastUpdateAt = now;

    const normalized = Math.min(
      Math.max(state.smoothSpeed / WebAudioStrokeSound.SPEED_REFERENCE, 0),
      1,
    );
    const curve = Math.sqrt(normalized);
    const freqMultiplier =
      profile.freqMinMultiplier +
      (profile.freqMaxMultiplier - profile.freqMinMultiplier) * curve;
    const targetFreq = Math.min(
      profile.bandpassFrequency * freqMultiplier,
      profile.lowpassFrequency * 0.95,
    );
    this.scheduleParam(
      state.bandpass.frequency,
      Math.max(targetFreq, 60),
      WebAudioStrokeSound.PARAM_SMOOTH_SEC,
      now,
    );

    let targetGain = profile.minGain + state.smoothSpeed * profile.gainScale;
    targetGain = Math.min(Math.max(targetGain, 0), 1);
    const isInitial =
      forceInitial ||
      info.timeSinceStart < WebAudioStrokeSound.INITIAL_GUARANTEE_MS ||
      info.length <= WebAudioStrokeSound.INITIAL_HOLD_LENGTH_PX;

    // 速度ゲート（ヒステリシス＋ホールド）で停止付近のノイズを確実にカット
    const wasGateOpen = state.gateOpen;
    this.updateGateState(state, now, isInitial);

    if (!state.gateOpen) {
      targetGain = 0;
    } else {
      targetGain = Math.max(targetGain, profile.minGain);
    }
    const gateJustClosed = wasGateOpen && !state.gateOpen;
    const gainTimeConstant = gateJustClosed
      ? WebAudioStrokeSound.GATE_RELEASE_SEC
      : WebAudioStrokeSound.PARAM_SMOOTH_SEC;
    this.scheduleGain(state, targetGain, gainTimeConstant);
  }

  private calculateInstantSpeed(
    info: StrokeSoundInfo,
    state: ToolState,
  ): number {
    const dtMs = info.timeSinceStart - state.lastTimeSinceStart;
    if (dtMs <= 0) return 0;
    const dx = info.length - state.lastLength;
    if (dx <= 0) return 0;
    return dx / dtMs;
  }

  private scheduleGain(
    state: ToolState,
    gain: number,
    timeConstant: number,
  ): void {
    const context = this.audioContext;
    if (!context) return;
    const now = context.currentTime;
    this.scheduleParam(state.gain.gain, gain, timeConstant, now);
  }

  private updateGateState(
    state: ToolState,
    now: number,
    isInitial: boolean,
  ): void {
    const gateHoldSec = WebAudioStrokeSound.GATE_HOLD_MS / 1000;
    if (WebAudioStrokeSound.ALWAYS_SOUND_WHILE_DRAWING && state.strokeActive) {
      state.gateOpen = true;
      state.gateHoldUntil = now + gateHoldSec;
      return;
    }

    if (isInitial) {
      state.gateOpen = true;
      state.gateHoldUntil = now + gateHoldSec;
      return;
    }

    if (state.gateOpen) {
      if (state.smoothSpeed > WebAudioStrokeSound.GATE_OFF_SPEED) {
        // 動いている間はホールド期限を更新し、減速時の短い揺れで切れないようにする
        state.gateHoldUntil = now + gateHoldSec;
      } else if (now >= state.gateHoldUntil) {
        state.gateOpen = false;
      }
      return;
    }

    if (state.smoothSpeed >= WebAudioStrokeSound.GATE_ON_SPEED) {
      state.gateOpen = true;
      state.gateHoldUntil = now + gateHoldSec;
    }
  }

  private scheduleParam(
    param: AudioParam,
    value: number,
    timeConstant: number,
    now: number,
  ): void {
    const paramWithHold = param as AudioParam & {
      cancelAndHoldAtTime?: (time: number) => void;
    };
    if (paramWithHold.cancelAndHoldAtTime) {
      paramWithHold.cancelAndHoldAtTime(now);
    } else {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
    }
    param.setTargetAtTime(value, now, timeConstant);
  }

  private scheduleStop(state: ToolState, delayMs: number): void {
    this.cancelStop(state);
    state.stopTimeoutId = setTimeout(() => {
      if (!state.source) return;
      if (this.isBufferSource(state.source)) {
        try {
          state.source.stop();
        } catch {
          // 無視
        }
      }
      state.source.disconnect();
      state.source = null;
      state.sourceKind = null;
      state.stopTimeoutId = null;
    }, delayMs);
  }

  private cancelStop(state: ToolState): void {
    if (state.stopTimeoutId !== null) {
      clearTimeout(state.stopTimeoutId);
      state.stopTimeoutId = null;
    }
  }

  private isBufferSource(
    source: AudioBufferSourceNode | AudioWorkletNode | null,
  ): source is AudioBufferSourceNode {
    return Boolean(
      source && typeof (source as AudioBufferSourceNode).stop === "function",
    );
  }

  private scheduleIdleCheck(state: ToolState, context: AudioContext): void {
    this.clearIdleCheck(state);
    state.idleTimeoutId = setTimeout(() => {
      state.idleTimeoutId = null;
      if (!state.strokeActive) return;
      const now = context.currentTime;
      if (
        now - state.lastInputAt <
        WebAudioStrokeSound.IDLE_TIMEOUT_MS / 1000
      ) {
        // 入力が継続している場合は再スケジュール
        this.scheduleIdleCheck(state, context);
        return;
      }
      if (state.lastLength <= WebAudioStrokeSound.INITIAL_HOLD_LENGTH_PX) {
        // 書き始めの極小移動は音を維持する
        this.scheduleIdleCheck(state, context);
        return;
      }
      state.smoothSpeed = 0;
      this.scheduleParam(
        state.bandpass.frequency,
        state.profile.bandpassFrequency,
        WebAudioStrokeSound.PARAM_SMOOTH_SEC,
        now,
      );
      if (WebAudioStrokeSound.ALWAYS_SOUND_WHILE_DRAWING) {
        state.gateOpen = true;
        state.gateHoldUntil = now + WebAudioStrokeSound.GATE_HOLD_MS / 1000;
        this.scheduleGain(
          state,
          state.profile.minGain,
          WebAudioStrokeSound.PARAM_SMOOTH_SEC,
        );
        return;
      }
      state.gateOpen = false;
      state.gateHoldUntil = now;
      this.scheduleGain(state, 0, WebAudioStrokeSound.GATE_RELEASE_SEC);
    }, WebAudioStrokeSound.IDLE_TIMEOUT_MS);
  }

  private clearIdleCheck(state: ToolState): void {
    if (state.idleTimeoutId !== null) {
      clearTimeout(state.idleTimeoutId);
      state.idleTimeoutId = null;
    }
  }

  private preloadWorklet(context: AudioContext): void {
    if (!context.audioWorklet) return;
    if (this.workletLoadPromise) return;
    const url = this.getWorkletUrl();
    if (!url) return;
    this.workletLoadPromise = context.audioWorklet
      .addModule(url)
      .then(() => {
        this.workletLoaded = true;
      })
      .catch(() => {
        this.workletLoaded = false;
      });
  }

  private getWorkletUrl(): string | null {
    if (this.workletUrl) return this.workletUrl;
    if (typeof Blob === "undefined" || typeof URL === "undefined") {
      return null;
    }
    const noiseGain = WebAudioStrokeSound.NOISE_GAIN;
    const source = `
class PinkNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.b0 = 0;
    this.b1 = 0;
    this.b2 = 0;
    this.b3 = 0;
    this.b4 = 0;
    this.b5 = 0;
    this.b6 = 0;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const channel = output[0];
    for (let i = 0; i < channel.length; i++) {
      const white = Math.random() * 2 - 1;
      this.b0 = 0.99886 * this.b0 + white * 0.0555179;
      this.b1 = 0.99332 * this.b1 + white * 0.0750759;
      this.b2 = 0.969 * this.b2 + white * 0.153852;
      this.b3 = 0.8665 * this.b3 + white * 0.3104856;
      this.b4 = 0.55 * this.b4 + white * 0.5329522;
      this.b5 = -0.7616 * this.b5 - white * 0.016898;
      const pink =
        this.b0 +
        this.b1 +
        this.b2 +
        this.b3 +
        this.b4 +
        this.b5 +
        this.b6 +
        white * 0.5362;
      this.b6 = white * 0.115926;
      channel[i] = pink * ${noiseGain};
    }
    if (output.length > 1) {
      for (let c = 1; c < output.length; c++) {
        output[c].set(channel);
      }
    }
    return true;
  }
}

registerProcessor("pink-noise-processor", PinkNoiseProcessor);
`;
    const blob = new Blob([source], { type: "application/javascript" });
    this.workletUrl = URL.createObjectURL(blob);
    return this.workletUrl;
  }
}
