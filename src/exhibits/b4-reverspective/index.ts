import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { createProjectorMaterial, projectToCanvas } from '../common/ProjectorMaterial';
import { mulberry32 } from '../../world/materials';
import { rectCollider } from '../../world/collision';
import type { ExhibitContext, ViewMode } from '../types';
import {
  ALLOW_SHIFT,
  EYE,
  FOV,
  FRUSTUMS,
  LOOK_AT,
  PLAQUE,
  frustumCorners,
  streetFrame,
  type P2,
  type P3,
} from './design';

const ASPECT = 1.7;

const FACADES = ['#e9c7a2', '#c7d6e6', '#f1e1b0', '#dcb4b0', '#b9d5bf', '#d8cde6'];

function poly(ctx: CanvasRenderingContext2D, pts: P2[], fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}

const lerp2 = (a: P2, b: P2, k: number): P2 => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
});

/** プロジェクタ（推奨視点）から見た街の絵を描く */
function paintCity(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: THREE.PerspectiveCamera,
) {
  const rand = mulberry32(5);
  const proj = (p: P3) => projectToCanvas(cam, p, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#6ea7de');
  sky.addColorStop(1, '#e3eef4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 9; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.5;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(x + k * w * 0.02, y + (k % 2) * h * 0.01, w * 0.03, h * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  FRUSTUMS.forEach((f, fi) => {
    const c = frustumCorners(f);
    const qb = c.back.map(proj);
    const qf = c.front.map(proj);
    const s = streetFrame(qb, qf);
    const [bTL, bTR, bBR, bBL] = qb as [P2, P2, P2, P2];

    // 奥の空（上面）
    const streetSky = ctx.createLinearGradient(0, bTL.y, 0, qf[0]!.y);
    streetSky.addColorStop(0, '#5f9bd6');
    streetSky.addColorStop(1, '#cfe3f1');
    poly(ctx, [bTL, bTR, qf[1]!, qf[0]!], streetSky);

    // 路面（下面）
    poly(ctx, [bBL, bBR, qf[2]!, qf[3]!], '#4b4b52');
    const road = (w0: number, w1: number, t0: number, t1: number, color: string) =>
      poly(
        ctx,
        [
          s.at(lerp2(bBL, bBR, w0), t0),
          s.at(lerp2(bBL, bBR, w1), t0),
          s.at(lerp2(bBL, bBR, w1), t1),
          s.at(lerp2(bBL, bBR, w0), t1),
        ],
        color,
      );
    road(0, 0.14, 0, 1, '#a9a49b');
    road(0.86, 1, 0, 1, '#a9a49b');
    for (let t = 0; t < 1; t += 0.1) road(0.485, 0.515, t, t + 0.05, '#f2efe6');

    // 両側の建物
    const facade = (edge0: P2, edge1: P2, seed: number) => {
      const at = (t: number, hh: number) => s.at(lerp2(edge0, edge1, hh), t);
      poly(ctx, [at(0, 0), at(1, 0), at(1, 1), at(0, 1)], '#cfe3f1');
      const cuts = [0, 0.2, 0.42, 0.6, 0.78, 1];
      for (let b = 0; b < cuts.length - 1; b++) {
        const t0 = cuts[b]!;
        const t1 = cuts[b + 1]!;
        const top = 0.68 + ((b * 37 + seed * 11) % 10) / 30;
        const color = FACADES[(b + seed * 2) % FACADES.length]!;
        poly(ctx, [at(t0, 0), at(t1, 0), at(t1, top), at(t0, top)], color);
        // 軒
        poly(
          ctx,
          [at(t0, top - 0.025), at(t1, top - 0.025), at(t1, top), at(t0, top)],
          'rgba(0,0,0,0.25)',
        );
        // 窓
        const floors = 5;
        const cols = 3;
        for (let fl = 0; fl < floors; fl++) {
          const h0 = 0.12 + (fl * (top - 0.18)) / floors;
          const h1 = h0 + ((top - 0.18) / floors) * 0.55;
          for (let k = 0; k < cols; k++) {
            const a = t0 + ((t1 - t0) * (k + 0.25)) / cols;
            const z = t0 + ((t1 - t0) * (k + 0.75)) / cols;
            poly(ctx, [at(a, h0), at(z, h0), at(z, h1), at(a, h1)], '#2f4a6b');
            poly(
              ctx,
              [at(a, h1 - (h1 - h0) * 0.3), at(z, h1 - (h1 - h0) * 0.3), at(z, h1), at(a, h1)],
              '#6f8fb0',
            );
          }
        }
        // 1 階の入口
        poly(
          ctx,
          [
            at(t0 + (t1 - t0) * 0.4, 0),
            at(t0 + (t1 - t0) * 0.6, 0),
            at(t0 + (t1 - t0) * 0.6, 0.09),
            at(t0 + (t1 - t0) * 0.4, 0.09),
          ],
          '#5a3d2b',
        );
      }
    };
    facade(bBL, bTL, fi * 3 + 1);
    facade(bBR, bTR, fi * 3 + 2);

    // 前面: 街路のいちばん奥の眺め（遠くのビル群と塔）
    const [fTL, fTR, fBR, fBL] = qf as [P2, P2, P2, P2];
    const vista = ctx.createLinearGradient(0, fTL.y, 0, fBL.y);
    vista.addColorStop(0, '#b9d7ee');
    vista.addColorStop(1, '#eef4f6');
    poly(ctx, [fTL, fTR, fBR, fBL], vista);
    const fw = fTR.x - fTL.x;
    const fh = fBL.y - fTL.y;
    for (let i = 0; i < 9; i++) {
      const x0 = fTL.x + (fw * i) / 9;
      const bh = fh * (0.18 + ((i * 7 + fi * 3) % 5) * 0.06);
      poly(
        ctx,
        [
          { x: x0, y: fBL.y },
          { x: x0 + fw / 9 + 0.5, y: fBL.y },
          { x: x0 + fw / 9 + 0.5, y: fBL.y - bh },
          { x: x0, y: fBL.y - bh },
        ],
        i % 2 ? '#9fb3c4' : '#8aa0b3',
      );
    }
    const tx = fTL.x + fw * (fi === 0 ? 0.68 : 0.32);
    poly(
      ctx,
      [
        { x: tx - fw * 0.03, y: fBL.y },
        { x: tx + fw * 0.03, y: fBL.y },
        { x: tx + fw * 0.012, y: fTL.y + fh * 0.18 },
        { x: tx, y: fTL.y + fh * 0.08 },
        { x: tx - fw * 0.012, y: fTL.y + fh * 0.18 },
      ],
      '#6d8196',
    );
    poly(
      ctx,
      [lerp2(fBL, fBR, 0.3), lerp2(fBL, fBR, 0.7), lerp2(fBL, fBR, 0.52), lerp2(fBL, fBR, 0.48)],
      '#4b4b52',
    );
  });
}

export class ReverspectiveExhibit extends BaseExhibit {
  readonly id = 'reverspective' as const;
  readonly viewMode: ViewMode = {
    kind: 'fixed',
    position: [EYE.x, EYE.y, EYE.z],
    target: [LOOK_AT.x, LOOK_AT.y, LOOK_AT.z],
    fov: FOV,
    allowShift: ALLOW_SHIFT,
  };
  readonly colliders = [rectCollider(-PLAQUE.width / 2 - 0.05, 0, PLAQUE.width / 2 + 0.05, 0.55)];
  readonly captionAnchor = { position: [PLAQUE.width / 2 + 0.35, 1.3, 0.005] as const };
  private readonly wire = new THREE.Group();

  protected build(ctx: ExhibitContext): void {
    const cam = new THREE.PerspectiveCamera(40, ASPECT, 0.1, 20);
    cam.position.set(EYE.x, EYE.y, EYE.z);
    cam.lookAt(LOOK_AT.x, LOOK_AT.y, LOOK_AT.z);
    cam.updateMatrixWorld(true);

    const width = Math.min(2048, ctx.textureSize * 2);
    const height = Math.round(width / ASPECT);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paintCity(canvas.getContext('2d')!, width, height, cam);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
    const mat = createProjectorMaterial(tex, cam, { outside: 0xf4f3ef, side: THREE.DoubleSide });

    // 背板
    const P = PLAQUE;
    // 投影は展示ローカル座標で計算するので、ジオメトリ自体を所定の位置に置く（メッシュは単位行列）
    const faceGeo = new THREE.PlaneGeometry(P.width, P.height);
    faceGeo.translate(0, P.centerY, P.depth);
    const face = new THREE.Mesh(faceGeo, mat);
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(P.width + 0.04, P.height + 0.04, P.depth),
      new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.5 }),
    );
    edge.position.set(0, P.centerY, P.depth / 2 - 0.001);
    this.root.add(edge, face);

    // 角錐台
    for (const f of FRUSTUMS) {
      const { back, front } = frustumCorners(f);
      const quads: P3[][] = [
        [back[0]!, back[1]!, front[1]!, front[0]!],
        [back[1]!, back[2]!, front[2]!, front[1]!],
        [back[2]!, back[3]!, front[3]!, front[2]!],
        [back[3]!, back[0]!, front[0]!, front[3]!],
        [front[0]!, front[1]!, front[2]!, front[3]!],
      ];
      const pos: number[] = [];
      for (const q of quads) {
        for (const i of [0, 1, 2, 0, 2, 3]) pos.push(q[i]!.x, q[i]!.y, q[i]!.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = 'frustum';
      this.root.add(mesh);
      const lines = new THREE.LineSegments(
        new THREE.EdgesGeometry(g),
        new THREE.LineBasicMaterial({ color: 0xff6a00, toneMapped: false }),
      );
      this.wire.add(lines);
    }
    this.wire.visible = false;
    this.root.add(this.wire);
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    this.wire.visible = true;
    if (!(await this.wait(1.2, signal))) return false;
    const ok = await this.ctx.rig.flyTo(
      { position: [2.9, 1.9, 0.9], target: [-0.2, 1.6, 0.2], via: [2.8, 1.8, 3.1], fov: 42 },
      3,
      signal,
    );
    if (!ok) return false;
    if (!(await this.wait(4.5, signal))) return false;
    if (!(await this.ctx.rig.returnToView(2.6, signal))) return false;
    return this.wait(0.8, signal);
  }

  protected override resetDemo(): void {
    this.wire.visible = false;
  }
}
