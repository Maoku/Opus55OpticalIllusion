import type * as THREE from 'three';

export type FrameCallback = (dt: number, time: number) => void;

/** 1 フレームの経過時間の上限（タブ復帰時などの大きな飛びを抑える） */
const MAX_DT = 1 / 20;

export class Loop {
  private last = -1;
  private running = false;
  /** 直近の平均 FPS（指数移動平均） */
  fps = 60;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly onFrame: FrameCallback,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private tick(timeMs: number): void {
    const time = timeMs / 1000;
    const raw = this.last < 0 ? 1 / 60 : time - this.last;
    this.last = time;
    if (raw > 0) this.fps += (1 / raw - this.fps) * 0.05;
    this.onFrame(Math.min(raw, MAX_DT), time);
  }
}
