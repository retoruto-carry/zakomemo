import { Howl } from "howler";
import type { StrokeSound, StrokeSoundInfo } from "../../engine/ports";

/**
 * Howler.jsを使用した描画音の実装
 * 各ツール（ペン、パターン、消しゴム）ごとに独立した音源を管理
 */
export class HowlerStrokeSound implements StrokeSound {
  private drawLoops: Map<"pen" | "pattern" | "eraser", Howl> = new Map();

  constructor() {
    // 初期実装ではすべてのツールで同じ音源を使用
    const defaultSound = "/audios/se/select1.mp3";

    // 各ツール用の音源を初期化
    this.drawLoops.set(
      "pen",
      new Howl({
        src: [defaultSound],
        loop: true,
        volume: 0,
      }),
    );
    this.drawLoops.set(
      "pattern",
      new Howl({
        src: [defaultSound],
        loop: true,
        volume: 0,
      }),
    );
    this.drawLoops.set(
      "eraser",
      new Howl({
        src: [defaultSound],
        loop: true,
        volume: 0,
      }),
    );
  }

  /**
   * 他のツールの音をフェードアウトし、現在のツールの音をフェードイン
   */
  onStrokeStart(info: StrokeSoundInfo): void {
    const drawLoop = this.drawLoops.get(info.tool);
    if (!drawLoop) return;

    // 他のツールの音を停止
    for (const [tool, loop] of this.drawLoops) {
      if (tool !== info.tool && loop.playing()) {
        const current = loop.volume();
        loop.fade(current, 0, 50);
      }
    }

    if (!drawLoop.playing()) {
      drawLoop.play();
    }
    drawLoop.volume(0);
    drawLoop.fade(0, 0.3, 120);
    this.updateVolume(info);
  }

  onStrokeUpdate(info: StrokeSoundInfo): void {
    this.updateVolume(info);
  }

  onStrokeEnd(_info: StrokeSoundInfo): void {
    const drawLoop = this.drawLoops.get(_info.tool);
    if (!drawLoop) return;

    const current = drawLoop.volume();
    drawLoop.fade(current, 0, 180);
  }

  private updateVolume(info: StrokeSoundInfo) {
    const drawLoop = this.drawLoops.get(info.tool);
    if (!drawLoop) return;

    const volume = Math.min(0.1 + info.speed * 0.5, 1);
    drawLoop.volume(volume);
  }
}
