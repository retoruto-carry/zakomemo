import { Howl } from "howler";
import type { StrokeSound, StrokeSoundInfo } from "../engine/ports";

export class HowlerStrokeSound implements StrokeSound {
  private drawLoop: Howl;

  constructor() {
    this.drawLoop = new Howl({
      src: ["/sounds/draw-loop.mp3"],
      loop: true,
      volume: 0,
    });
  }

  onStrokeStart(info: StrokeSoundInfo): void {
    if (!this.drawLoop.playing()) {
      this.drawLoop.play();
    }
    this.drawLoop.volume(0);
    this.drawLoop.fade(0, 0.3, 120);
    this.updateVolume(info);
  }

  onStrokeUpdate(info: StrokeSoundInfo): void {
    this.updateVolume(info);
  }

  onStrokeEnd(info: StrokeSoundInfo): void {
    const current = this.drawLoop.volume();
    this.drawLoop.fade(current, 0, 180);
  }

  private updateVolume(info: StrokeSoundInfo) {
    const volume = Math.min(0.1 + info.speed * 0.5, 1);
    this.drawLoop.volume(volume);
  }
}
