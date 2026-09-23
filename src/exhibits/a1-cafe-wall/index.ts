import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { createArtCanvas, type ArtCanvas } from '../common/canvasTexture';
import { createFramedArt } from '../common/frame';
import type { ExhibitContext, Tunable, ViewMode } from '../types';
import {
  CAFE_WALL_COLORS,
  CAFE_WALL_DEFAULTS,
  cafeWallPattern,
  type CafeWallPattern,
} from './pattern';

/** 作品面の幅（m） */
const ART_W = 2.6;
const CENTER_Y = 1.6;

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: CafeWallPattern): void {
  const s = w / p.width;
  ctx.fillStyle = CAFE_WALL_COLORS.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = CAFE_WALL_COLORS.white;
  ctx.fillRect(p.field.x * s, p.field.y * s, p.field.w * s, p.field.h * s);
  ctx.fillStyle = CAFE_WALL_COLORS.black;
  for (const t of p.blackTiles) ctx.fillRect(t.x * s, t.y * s, t.w * s, t.h * s);
  ctx.fillStyle = CAFE_WALL_COLORS.mortar;
  for (const m of p.mortarLines) ctx.fillRect(m.x * s, m.y * s, m.w * s, m.h * s);
}

export class CafeWallExhibit extends BaseExhibit {
  readonly id = 'cafe-wall' as const;
  readonly viewMode: ViewMode;
  private readonly artH: number;
  private art: ArtCanvas | null = null;
  private readonly guides = new THREE.Group();
  private readonly guideMat = new THREE.MeshBasicMaterial({
    color: 0xff2020,
    transparent: true,
    opacity: 0,
    toneMapped: false,
    depthWrite: false,
  });
  private shift = CAFE_WALL_DEFAULTS.shift;
  private mortar = CAFE_WALL_DEFAULTS.mortar;
  readonly tunables: Tunable[] = [
    {
      label: '目地の太さ（タイル比）',
      min: 0.02,
      max: 0.2,
      step: 0.005,
      get: () => this.mortar,
      set: (v) => {
        this.mortar = v;
        this.art?.redraw((c, w, h) =>
          draw(c, w, h, cafeWallPattern({ shift: this.shift, mortar: v })),
        );
      },
    },
  ];

  constructor() {
    super();
    const p = cafeWallPattern();
    this.artH = (ART_W * p.height) / p.width;
    this.viewMode = { kind: 'front', center: [0, CENTER_Y, 0.04], width: ART_W, height: this.artH };
  }

  protected build(ctx: ExhibitContext): void {
    const p = cafeWallPattern({ shift: this.shift });
    this.art = createArtCanvas(
      p.width / p.height,
      ctx.textureSize,
      (c, w, h) => draw(c, w, h, p),
      ctx.renderer,
    );
    const framed = createFramedArt(this.art.texture, {
      width: ART_W,
      height: this.artH,
      centerY: CENTER_Y,
    });
    this.root.add(framed.group);

    // デモ用の赤いガイド線（目地の中心に重ねる）
    const s = ART_W / p.width;
    for (const m of p.mortarLines) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(ART_W * 0.98, 0.006), this.guideMat);
      const yCanvas = (m.y + m.h / 2) * s;
      line.position.set(0, this.artH / 2 - yCanvas, 0);
      this.guides.add(line);
    }
    this.guides.visible = false;
    framed.overlay.add(this.guides);
  }

  private setShift(shift: number): void {
    if (!this.art || Math.abs(shift - this.shift) < 1e-4) return;
    this.shift = shift;
    const p = cafeWallPattern({ shift, mortar: this.mortar });
    this.art.redraw((c, w, h) => draw(c, w, h, p));
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    this.guides.visible = true;
    if (!(await this.animate(0.6, (t) => (this.guideMat.opacity = 0.9 * t), signal))) return false;
    if (!(await this.wait(1.6, signal))) return false;
    const from = CAFE_WALL_DEFAULTS.shift;
    if (!(await this.animate(2.2, (t) => this.setShift(from * (1 - t)), signal))) return false;
    if (!(await this.wait(2.4, signal))) return false;
    if (!(await this.animate(1.4, (t) => this.setShift(from * t), signal))) return false;
    return this.animate(0.5, (t) => (this.guideMat.opacity = 0.9 * (1 - t)), signal);
  }

  protected override resetDemo(): void {
    this.guideMat.opacity = 0;
    this.guides.visible = false;
    this.setShift(CAFE_WALL_DEFAULTS.shift);
  }

  override dispose(): void {
    super.dispose();
    this.guideMat.dispose();
  }
}
