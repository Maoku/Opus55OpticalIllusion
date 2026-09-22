import { FlatArtExhibit } from '../common/FlatArtExhibit';
import {
  BAND_WIDTHS,
  DRIFT_ASPECT,
  DRIFT_SEQUENCE,
  STATIC_SEQUENCE,
  driftDiscs,
  driftWedges,
  type Step,
} from './pattern';

/** 輝度の段階ごとの色（黒 → 濃い青緑 → 白 → 淡い山吹） */
const STEP_COLORS: Record<Step, string> = {
  0: '#0e0e10',
  1: '#23647f',
  2: '#ffffff',
  3: '#f1c75a',
};
const BACKGROUND = '#8e887c';

const LABELS: Record<Step, string> = { 0: '黒', 1: '濃', 2: '白', 3: '淡' };

export class PeripheralDriftExhibit extends FlatArtExhibit {
  readonly id = 'peripheral-drift' as const;
  protected readonly artWidth = 2.4;
  protected readonly aspect = DRIFT_ASPECT;
  private sequence: readonly Step[] = DRIFT_SEQUENCE;
  private annotate = false;

  protected paint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = h;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    for (const d of driftDiscs()) {
      ctx.fillStyle = '#4a463f';
      ctx.beginPath();
      ctx.arc(d.cx * s, d.cy * s, d.radius * s * 1.02, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const wdg of driftWedges({ sequence: this.sequence })) {
      ctx.fillStyle = STEP_COLORS[wdg.step];
      ctx.beginPath();
      ctx.arc(wdg.cx * s, wdg.cy * s, wdg.r1 * s, wdg.a0, wdg.a1 + 0.002);
      ctx.arc(wdg.cx * s, wdg.cy * s, wdg.r0 * s, wdg.a1 + 0.002, wdg.a0, true);
      ctx.closePath();
      ctx.fill();
    }
    if (this.annotate) this.paintAnnotation(ctx, s);
  }

  /** デモ用: 1 つの区画を囲み、帯の並びをラベルで示す */
  private paintAnnotation(ctx: CanvasRenderingContext2D, s: number): void {
    const { u, v, radius, a0, seg } = this.focus();
    const cx = u * s;
    const cy = v * s;
    ctx.strokeStyle = '#ff2d2d';
    ctx.lineWidth = 0.004 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, radius.r1 * s + 0.004 * s, a0, a0 + seg);
    ctx.arc(cx, cy, radius.r0 * s - 0.004 * s, a0 + seg, a0, true);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#ff2d2d';
    ctx.font = `700 ${Math.round(0.018 * s)}px "Hiragino Sans","Noto Sans JP",sans-serif`;
    ctx.textAlign = 'center';
    let a = a0;
    for (let b = 0; b < 4; b++) {
      const width = BAND_WIDTHS[b]! * seg;
      const mid = a + width / 2;
      const r = radius.r1 + 0.02;
      ctx.fillText(
        LABELS[this.sequence[b]!],
        cx + Math.cos(mid) * r * s,
        cy + Math.sin(mid) * r * s + 0.006 * s,
      );
      a += width;
    }
  }

  /** 拡大する区画（左上の円盤） */
  private focus() {
    const disc = driftDiscs()[0]!;
    // 角度が増える向きに並ぶ輪のうち、いちばん外側
    const wedges = driftWedges({ sequence: this.sequence }).filter(
      (w) => w.cx === disc.cx && w.cy === disc.cy && w.dir === 1,
    );
    const outer = Math.max(...wedges.map((w) => w.r1));
    const ring = wedges.filter((w) => w.r1 === outer);
    // 右上（角度 -0.6 付近）の区画の先頭
    const segWedges = ring.slice(0, 4);
    const seg = segWedges.reduce((sum, w) => sum + (w.a1 - w.a0), 0);
    const start = Math.min(...segWedges.map((w) => w.a0));
    const shift = Math.round((-0.6 - start) / seg) * seg;
    return {
      u: disc.cx,
      v: disc.cy,
      radius: { r0: ring[0]!.r0, r1: outer },
      a0: start + shift,
      seg,
    };
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    this.annotate = true;
    this.repaint();
    const f = this.focus();
    const mid = f.a0 + f.seg / 2;
    const r = (f.radius.r0 + f.radius.r1) / 2;
    const u = (f.u + Math.cos(mid) * r) / DRIFT_ASPECT;
    const v = f.v + Math.sin(mid) * r;
    const target = this.artPoint(u, v);
    if (
      !(await this.ctx.rig.flyTo(
        { position: [target[0], target[1], 0.75], target, fov: 30 },
        2,
        signal,
      ))
    )
      return false;
    if (!(await this.wait(4, signal))) return false;
    // 並び順を左右対称に入れ替えると、回転は止まって見える
    this.sequence = STATIC_SEQUENCE;
    this.repaint();
    if (!(await this.wait(1.5, signal))) return false;
    if (!(await this.ctx.rig.returnToView(1.8, signal))) return false;
    this.annotate = false;
    this.repaint();
    if (!(await this.wait(5, signal))) return false;
    this.sequence = DRIFT_SEQUENCE;
    this.repaint();
    return true;
  }

  protected override resetDemo(): void {
    this.sequence = DRIFT_SEQUENCE;
    this.annotate = false;
    this.repaint();
  }
}
