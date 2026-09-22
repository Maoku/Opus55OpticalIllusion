export type Easing = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
} satisfies Record<string, Easing>;

interface Tween {
  elapsed: number;
  duration: number;
  ease: Easing;
  onUpdate: (t: number) => void;
  resolve: (completed: boolean) => void;
  signal?: AbortSignal;
}

/**
 * メインループで進めるトゥイーン。
 * run() は完了すると true、signal で中断されると false で解決する（例外は投げない）。
 */
export class Tweens {
  private list: Tween[] = [];

  run(
    duration: number,
    onUpdate: (t: number) => void,
    opts: { ease?: Easing; signal?: AbortSignal } = {},
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (opts.signal?.aborted) {
        resolve(false);
        return;
      }
      if (duration <= 0) {
        onUpdate(1);
        resolve(true);
        return;
      }
      const tween: Tween = {
        elapsed: 0,
        duration,
        ease: opts.ease ?? ease.inOutCubic,
        onUpdate,
        resolve,
        signal: opts.signal,
      };
      opts.signal?.addEventListener(
        'abort',
        () => {
          this.list = this.list.filter((t) => t !== tween);
          resolve(false);
        },
        { once: true },
      );
      onUpdate(0);
      this.list.push(tween);
    });
  }

  /** 指定秒数待つ */
  wait(seconds: number, signal?: AbortSignal): Promise<boolean> {
    return this.run(seconds, () => undefined, { ease: ease.linear, signal });
  }

  update(dt: number): void {
    if (this.list.length === 0) return;
    const done: Tween[] = [];
    for (const t of [...this.list]) {
      t.elapsed += dt;
      const k = Math.min(1, t.elapsed / t.duration);
      t.onUpdate(t.ease(k));
      if (k >= 1) done.push(t);
    }
    if (done.length) {
      this.list = this.list.filter((t) => !done.includes(t));
      for (const t of done) t.resolve(true);
    }
  }

  get active(): number {
    return this.list.length;
  }
}

/** アプリ全体で共有するトゥイーン（App のループで update する） */
export const tweens = new Tweens();
