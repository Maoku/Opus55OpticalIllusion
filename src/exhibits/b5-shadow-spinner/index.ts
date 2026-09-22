import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { createFramedArt } from '../common/frame';
import type { ExhibitContext, ViewMode } from '../types';
import { createFigure, type FigureParts } from './figure';

/** スクリーンの大きさ（m） */
const SCREEN_W = 1.3;
const SCREEN_H = 1.9;
const CENTER_Y = 1.55;
/** 1 秒あたりの回転数 */
const TURNS_PER_SECOND = 0.55;
/** 影絵スクリーンの紙の色（背後から照らされた白） */
const PAPER = 0xfbf7ec;

/**
 * 回る影: 人型を別のシーンで回転させ、正射影カメラでレンダーターゲットに黒一色で描く。
 * それを額装した「影絵スクリーン」に表示する。正射影なので奥行きの手がかりがなく、回転の向きが決まらない。
 */
export class ShadowSpinnerExhibit extends BaseExhibit {
  readonly id = 'shadow-spinner' as const;
  readonly viewMode: ViewMode = {
    kind: 'front',
    center: [0, CENTER_Y, 0.04],
    width: SCREEN_W,
    height: SCREEN_H,
    fill: 0.78,
  };
  private rt: THREE.WebGLRenderTarget | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-0.95, 0.95, 1.39, -1.39, 0.1, 10);
  private readonly silhouette = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  private readonly shaded = new THREE.MeshLambertMaterial({ color: 0x8b8680 });
  private readonly turntable = new THREE.Group();
  private figure: FigureParts | null = null;
  private readonly cue = new THREE.Group();
  private angle = 0;

  protected build(ctx: ExhibitContext): void {
    const size = ctx.quality === 'low' ? 384 : 512;
    this.rt = new THREE.WebGLRenderTarget(size, Math.round((size * SCREEN_H) / SCREEN_W), {
      samples: 4,
    });

    this.scene.background = new THREE.Color(PAPER);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1.5, 2, 3);
    this.scene.add(key);

    this.figure = createFigure(this.silhouette);
    this.turntable.add(this.figure.group);
    // 足元の奥行きの手がかり（デモでだけ表示）: 回転台の円盤と、手前を示す印
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.02, 48),
      new THREE.MeshLambertMaterial({ color: 0xb8b2a8 }),
    );
    disc.position.y = 0.0;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9412b, emissive: 0x5a1208 }),
    );
    marker.position.set(0.38, 0.03, 0);
    this.cue.add(disc, marker);
    this.cue.visible = false;
    this.turntable.add(this.cue);
    this.turntable.position.y = -0.95;
    this.scene.add(this.turntable);

    // 横から、わずかに見下ろす正射影
    this.camera.position.set(0, 0.35, 4);
    this.camera.lookAt(0, 0, 0);

    const framed = createFramedArt(this.rt.texture, {
      width: SCREEN_W,
      height: SCREEN_H,
      centerY: CENTER_Y,
      color: 0x2a2a2c,
      glow: true,
    });
    this.root.add(framed.group);
    this.renderShadow(ctx.renderer);
  }

  private renderShadow(renderer: THREE.WebGLRenderer): void {
    if (!this.rt) return;
    const prev = renderer.getRenderTarget();
    const prevXr = renderer.xr.enabled;
    renderer.xr.enabled = false;
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prev);
    renderer.xr.enabled = prevXr;
  }

  update(dt: number, ctx: ExhibitContext): void {
    const speed = ctx.reducedMotion ? TURNS_PER_SECOND * 0.5 : TURNS_PER_SECOND;
    this.angle = (this.angle + dt * speed * Math.PI * 2) % (Math.PI * 2);
    this.turntable.rotation.y = this.angle;
    this.renderShadow(ctx.renderer);
  }

  /** 脚と足元に陰影をつけて、本当の回転方向の手がかりを与える */
  private setCue(on: boolean): void {
    if (!this.figure) return;
    for (const m of this.figure.legs) m.material = on ? this.shaded : this.silhouette;
    this.cue.visible = on;
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    this.setCue(true);
    return this.wait(9, signal);
  }

  protected override resetDemo(): void {
    this.setCue(false);
  }

  override dispose(): void {
    super.dispose();
    this.rt?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.silhouette.dispose();
    this.shaded.dispose();
  }
}
