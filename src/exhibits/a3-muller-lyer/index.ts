import { FlatArtExhibit } from '../common/FlatArtExhibit';
import { MULLER_LYER_ASPECT, SHAFT_LENGTH, mullerLyerPattern, type Segment } from './pattern';

const INK = '#1d1d1f';
const PAPER = '#f6f4ef';
const RULER = '#1f8a70';

export class MullerLyerExhibit extends FlatArtExhibit {
  readonly id = 'muller-lyer' as const;
  protected readonly artWidth = 2.2;
  protected readonly aspect = MULLER_LYER_ASPECT;
  private finAlpha = 1;
  /** 定規の表示（0: なし、0〜1: 上の線から下の線へ移動） */
  private rulerAlpha = 0;
  private rulerPos = 0;

  protected paint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = h;
    const p = mullerLyerPattern();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    const line = (seg: Segment, width: number) => {
      ctx.lineWidth = width * s;
      ctx.beginPath();
      ctx.moveTo(seg.x0 * s, seg.y0 * s);
      ctx.lineTo(seg.x1 * s, seg.y1 * s);
      ctx.stroke();
    };
    ctx.strokeStyle = INK;
    for (const f of [p.outward, p.inward]) line(f.shaft, 0.018);
    ctx.globalAlpha = this.finAlpha;
    for (const f of [p.outward, p.inward]) for (const fin of f.fins) line(fin, 0.018);
    ctx.globalAlpha = 1;

    if (this.rulerAlpha > 0) {
      const y = p.outward.shaft.y0 + (p.inward.shaft.y0 - p.outward.shaft.y0) * this.rulerPos;
      const x0 = p.outward.shaft.x0;
      ctx.globalAlpha = this.rulerAlpha;
      ctx.fillStyle = RULER;
      ctx.fillRect(x0 * s, (y - 0.045) * s, SHAFT_LENGTH * s, 0.03 * s);
      // 目盛り
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i <= 10; i++) {
        const x = (x0 + (SHAFT_LENGTH * i) / 10) * s;
        ctx.fillRect(x - 0.002 * s, (y - 0.045) * s, 0.004 * s, (i % 5 === 0 ? 0.03 : 0.015) * s);
      }
      // 端をそろえる補助線
      ctx.strokeStyle = RULER;
      ctx.setLineDash([0.012 * s, 0.012 * s]);
      ctx.lineWidth = 0.004 * s;
      for (const x of [x0, x0 + SHAFT_LENGTH]) {
        ctx.beginPath();
        ctx.moveTo(x * s, 0.18 * s);
        ctx.lineTo(x * s, 0.84 * s);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    const set = (fin: number, ruler: number, pos: number) => {
      this.finAlpha = fin;
      this.rulerAlpha = ruler;
      this.rulerPos = pos;
      this.repaint();
    };
    if (!(await this.animate(0.8, (t) => set(1, t, 0), signal))) return false;
    if (!(await this.wait(1, signal))) return false;
    if (!(await this.animate(1.6, (t) => set(1, 1, t), signal))) return false;
    if (!(await this.wait(1.2, signal))) return false;
    if (!(await this.animate(1.2, (t) => set(1 - t, 1, 1), signal))) return false;
    if (!(await this.wait(2.5, signal))) return false;
    return this.animate(1, (t) => set(t, 1 - t, 1), signal);
  }

  protected override resetDemo(): void {
    this.finAlpha = 1;
    this.rulerAlpha = 0;
    this.rulerPos = 0;
    this.repaint();
  }
}
