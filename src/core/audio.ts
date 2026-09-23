/**
 * 環境音と足音（外部の音声ファイルを使わず、WebAudio で手続き的に作る）。
 * ブラウザの自動再生の制限があるので、「入館する」などの操作の中で start() を呼ぶ。
 */
export class MuseumAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private stride = 0;
  private muted = true;

  /** ユーザー操作の中で呼ぶ。サウンドが無効なら何もしない */
  start(muted: boolean): void {
    this.muted = muted;
    if (muted || this.ctx) {
      this.applyMute();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // 1 秒分のブラウンノイズ（低い空調音のような響き）
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const room = ctx.createBufferSource();
    room.buffer = this.noise;
    room.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.22;
    room.connect(lp).connect(roomGain).connect(this.master);
    room.start();
    this.applyMute();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!muted && !this.ctx) return; // start() はユーザー操作のときに呼ばれる
    this.applyMute();
  }

  private applyMute(): void {
    if (!this.ctx || !this.master) return;
    if (!this.muted && this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, t, 0.3);
  }

  /** 歩く速さ（m/s）に合わせて足音を鳴らす */
  update(dt: number, speed: number): void {
    if (!this.ctx || !this.master || this.muted || speed < 0.3) {
      this.stride = 0.25;
      return;
    }
    this.stride -= dt * (speed / 0.75);
    if (this.stride > 0) return;
    this.stride += 1;
    this.step(0.55 + Math.min(1, speed / 2.5) * 0.35);
  }

  private step(volume: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 260 + Math.random() * 120;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t, Math.random() * 1.5, 0.15);
  }
}
