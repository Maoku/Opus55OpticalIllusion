import * as THREE from 'three';
import { FlatArtExhibit } from '../common/FlatArtExhibit';
import type { ExhibitContext, Tunable } from '../types';
import { GRID_COLORS, GRID_DEFAULTS, gridPattern, type GridOptions } from './pattern';

export class ScintillatingGridExhibit extends FlatArtExhibit {
  readonly id = 'scintillating-grid' as const;
  protected readonly artWidth = 1.9;
  protected readonly aspect = 1;
  /** 線の太さと円の大きさ（鑑賞距離での見え方に合わせて ?debug で調整する） */
  private readonly options: GridOptions = { ...GRID_DEFAULTS };
  readonly tunables: Tunable[] = [
    {
      label: '線の太さ（間隔比）',
      min: 0.06,
      max: 0.3,
      step: 0.005,
      get: () => this.options.lineWidth,
      set: (v) => {
        this.options.lineWidth = v;
        this.repaint();
      },
    },
    {
      label: '円の直径（線幅比）',
      min: 1,
      max: 2.4,
      step: 0.05,
      get: () => this.options.discScale,
      set: (v) => {
        this.options.discScale = v;
        this.repaint();
      },
    },
  ];
  /** 拡大鏡の枠（デモ用） */
  private readonly loupe = new THREE.Mesh(
    new THREE.RingGeometry(0.058, 0.066, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false,
    }),
  );

  protected paint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const p = gridPattern(this.options);
    const s = w;
    ctx.fillStyle = GRID_COLORS.background;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = GRID_COLORS.line;
    const lw = p.lineWidth * s;
    const a = p.extent.min * s;
    const len = (p.extent.max - p.extent.min) * s;
    for (const c of p.positions) {
      ctx.fillRect(c * s - lw / 2, a, lw, len);
      ctx.fillRect(a, c * s - lw / 2, len, lw);
    }
    ctx.fillStyle = GRID_COLORS.disc;
    for (const d of p.discs) {
      ctx.beginPath();
      ctx.arc(d.x * s, d.y * s, p.discRadius * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  protected override build(ctx: ExhibitContext): void {
    super.build(ctx);
    this.loupe.visible = false;
    this.framed?.overlay.add(this.loupe);
  }

  /** 拡大する交点（中央付近） */
  private focusDisc(): { u: number; v: number } {
    const p = gridPattern(this.options);
    const mid = p.positions[Math.floor(p.positions.length / 2) - 1]!;
    return { u: mid, v: mid };
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    const { u, v } = this.focusDisc();
    const [x, y] = this.artPoint(u, v);
    this.loupe.position.set(x, y - this.centerY, 0.001);
    this.loupe.visible = true;
    const mat = this.loupe.material;
    if (!(await this.animate(0.5, (t) => (mat.opacity = t), signal))) return false;
    if (!(await this.wait(0.8, signal))) return false;
    const target = this.artPoint(u, v);
    const ok = await this.ctx.rig.flyTo(
      { position: [target[0], target[1], target[2] + 0.55], target, fov: 30 },
      2,
      signal,
    );
    if (!ok) return false;
    if (!(await this.wait(3.5, signal))) return false;
    if (!(await this.ctx.rig.returnToView(1.6, signal))) return false;
    return this.animate(0.5, (t) => (mat.opacity = 1 - t), signal);
  }

  protected override resetDemo(): void {
    this.loupe.visible = false;
    this.loupe.material.opacity = 0;
  }
}
