import { FlatArtExhibit } from '../common/FlatArtExhibit';
import { EBBINGHAUS_ASPECT, EBBINGHAUS_COLORS, ebbinghausPattern, type Circle } from './pattern';

export class EbbinghausExhibit extends FlatArtExhibit {
  readonly id = 'ebbinghaus' as const;
  protected readonly artWidth = 2.4;
  protected readonly aspect = EBBINGHAUS_ASPECT;
  /** 周りの円の不透明度（デモでフェードアウトする） */
  private surroundAlpha = 1;
  /** 中央の円を並べる度合い */
  private separation = 0;

  protected paint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = h;
    const p = ebbinghausPattern(this.separation);
    ctx.fillStyle = EBBINGHAUS_COLORS.paper;
    ctx.fillRect(0, 0, w, h);
    const dot = (c: Circle) => {
      ctx.beginPath();
      ctx.arc(c.x * s, c.y * s, c.r * s, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.globalAlpha = this.surroundAlpha;
    ctx.fillStyle = EBBINGHAUS_COLORS.surround;
    [...p.left.surround, ...p.right.surround].forEach(dot);
    ctx.globalAlpha = 1;
    ctx.fillStyle = EBBINGHAUS_COLORS.center;
    dot(p.left.center);
    dot(p.right.center);
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    if (!(await this.wait(0.4, signal))) return false;
    const fade = (t: number) => {
      this.surroundAlpha = 1 - t;
      this.repaint();
    };
    if (!(await this.animate(1.4, fade, signal))) return false;
    const slide = (t: number) => {
      this.separation = t;
      this.repaint();
    };
    if (!(await this.animate(1.6, slide, signal))) return false;
    if (!(await this.wait(3, signal))) return false;
    if (!(await this.animate(1.2, (t) => slide(1 - t), signal))) return false;
    return this.animate(1, (t) => fade(1 - t), signal);
  }

  protected override resetDemo(): void {
    this.surroundAlpha = 1;
    this.separation = 0;
    this.repaint();
  }
}
