import { BaseExhibit } from './BaseExhibit';
import { createArtCanvas, type ArtCanvas } from './canvasTexture';
import { createFramedArt, type FramedArt } from './frame';
import type { ExhibitContext, ViewMode } from '../types';

/**
 * 壁に額装して正面から見る平面作品の共通実装。
 * サブクラスは作品面の大きさと paint()（Canvas への描画）を決める。状態を変えたら repaint() を呼ぶ。
 */
export abstract class FlatArtExhibit extends BaseExhibit {
  /** 作品面の幅（m） */
  protected abstract readonly artWidth: number;
  /** 作品面の縦横比（幅 / 高さ） */
  protected abstract readonly aspect: number;
  protected readonly centerY: number = 1.6;
  protected art: ArtCanvas | null = null;
  protected framed: FramedArt | null = null;

  get viewMode(): ViewMode {
    return {
      kind: 'front',
      center: [0, this.centerY, 0.04],
      width: this.artWidth,
      height: this.artHeight,
    };
  }

  get artHeight(): number {
    return this.artWidth / this.aspect;
  }

  protected abstract paint(ctx: CanvasRenderingContext2D, w: number, h: number): void;

  protected build(ctx: ExhibitContext): void {
    this.art = createArtCanvas(
      this.aspect,
      ctx.textureSize,
      (c, w, h) => this.paint(c, w, h),
      ctx.renderer,
    );
    this.framed = createFramedArt(this.art.texture, {
      width: this.artWidth,
      height: this.artHeight,
      centerY: this.centerY,
    });
    this.root.add(this.framed.group);
  }

  protected repaint(): void {
    this.art?.redraw((c, w, h) => this.paint(c, w, h));
  }

  /** 作品面のローカル座標（中心が原点、単位 m）を、額の手前の世界ではなく展示ローカル座標に直す */
  protected artPoint(u: number, v: number, z = 0): [number, number, number] {
    const surface = this.framed?.surfaceZ ?? 0.037;
    return [(u - 0.5) * this.artWidth, this.centerY + (0.5 - v) * this.artHeight, surface + z];
  }
}
