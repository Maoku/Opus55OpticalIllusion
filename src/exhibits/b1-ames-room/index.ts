import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { rectCollider } from '../../world/collision';
import type { ExhibitContext, ViewMode } from '../types';
import type { V3 } from '../common/viewpoint';
import {
  APPARENT,
  BOOTH,
  DOLL_HEIGHT,
  DOLL_LEFT,
  DOLL_RIGHT,
  PEEPHOLE,
  dollPath,
  toReal,
} from './room';

type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function canvasTexture(w: number, h: number, paint: Paint): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 壁面の陰影（隅に向かって少し暗くする。見かけの部屋の座標で焼き込む） */
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.28): void {
  const g = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.hypot(w, h) * 0.62,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const WALL = '#d8c3a0';
const BASEBOARD = '#5b4631';

function paintWall(windows: { x: number; w: number }[]): Paint {
  return (ctx, w, h) => {
    ctx.fillStyle = WALL;
    ctx.fillRect(0, 0, w, h);
    // 腰壁の線と幅木
    ctx.fillStyle = 'rgba(90,70,40,0.25)';
    ctx.fillRect(0, h * 0.6, w, h * 0.012);
    ctx.fillStyle = BASEBOARD;
    ctx.fillRect(0, h * 0.92, w, h * 0.08);
    ctx.fillStyle = '#efe6d4';
    ctx.fillRect(0, 0, w, h * 0.05);
    for (const win of windows) {
      const x0 = win.x * w;
      const ww = win.w * w;
      const y0 = h * 0.18;
      const wh = h * 0.36;
      const sky = ctx.createLinearGradient(0, y0, 0, y0 + wh);
      sky.addColorStop(0, '#6fa8dc');
      sky.addColorStop(1, '#cfe6f7');
      ctx.fillStyle = '#f7f3ea';
      ctx.fillRect(x0 - ww * 0.06, y0 - wh * 0.06, ww * 1.12, wh * 1.12);
      ctx.fillStyle = sky;
      ctx.fillRect(x0, y0, ww, wh);
      ctx.fillStyle = '#f7f3ea';
      ctx.fillRect(x0 + ww / 2 - ww * 0.025, y0, ww * 0.05, wh);
      ctx.fillRect(x0, y0 + wh / 2 - wh * 0.025, ww, wh * 0.05);
    }
    vignette(ctx, w, h, 0.22);
  };
}

const paintFloor: Paint = (ctx, w, h) => {
  const nx = 8;
  const nz = 6;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#1c1c1e' : '#ece7dc';
      ctx.fillRect((i * w) / nx, (j * h) / nz, w / nx + 1, h / nz + 1);
    }
  }
  vignette(ctx, w, h, 0.3);
};

const paintCeiling: Paint = (ctx, w, h) => {
  ctx.fillStyle = '#efe8da';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.12, 0, Math.PI * 2);
  ctx.fill();
  vignette(ctx, w, h, 0.35);
};

/** 見かけの部屋の長方形の面（原点 o、辺 u, v）を細かく分割し、実際の部屋へ写したジオメトリ */
function mappedPlane(o: V3, u: V3, v: V3, seg = 16): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const a = i / seg;
      const b = j / seg;
      const p: V3 = [
        o[0] + u[0] * a + v[0] * b,
        o[1] + u[1] * a + v[1] * b,
        o[2] + u[2] * a + v[2] * b,
      ];
      pos.push(...toReal(p));
      uv.push(a, b);
    }
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const k = j * (seg + 1) + i;
      idx.push(k, k + 1, k + seg + 1, k + 1, k + seg + 2, k + seg + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function createDoll(dress: number): THREE.Group {
  const g = new THREE.Group();
  const mat = (color: number) =>
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 });
  const H = DOLL_HEIGHT;
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(H * 0.2, H * 0.42, 20), mat(dress));
  skirt.position.y = H * 0.42;
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.07, H * 0.1, H * 0.2, 16),
    mat(dress),
  );
  torso.position.y = H * 0.68;
  const head = new THREE.Mesh(new THREE.SphereGeometry(H * 0.1, 20, 14), mat(0xf2c9a0));
  head.position.y = H * 0.88;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(H * 0.105, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0x3b2616),
  );
  hair.position.y = H * 0.9;
  const legGeo = new THREE.CylinderGeometry(H * 0.025, H * 0.025, H * 0.24, 8);
  const legL = new THREE.Mesh(legGeo, mat(0xf2c9a0));
  legL.position.set(-H * 0.05, H * 0.12, 0);
  const legR = legL.clone();
  legR.position.x = H * 0.05;
  const armGeo = new THREE.CylinderGeometry(H * 0.02, H * 0.02, H * 0.26, 8);
  const armL = new THREE.Mesh(armGeo, mat(0xf2c9a0));
  armL.position.set(-H * 0.12, H * 0.64, 0);
  armL.rotation.z = -0.35;
  const armR = armL.clone();
  armR.position.x = H * 0.12;
  armR.rotation.z = 0.35;
  g.add(skirt, torso, head, hair, legL, legR, armL, armR);
  return g;
}

export class AmesRoomExhibit extends BaseExhibit {
  readonly id = 'ames-room' as const;
  readonly viewMode: ViewMode = {
    kind: 'fixed',
    position: PEEPHOLE,
    target: [0, 1.33, -1.7],
    fov: 50,
  };
  readonly colliders = [rectCollider(BOOTH.x0, BOOTH.z0, BOOTH.x1, BOOTH.z1)];
  readonly captionAnchor = { position: [0.55, 1.3, 0.006] as const };
  readonly floorMark = false;
  private readonly dollA = createDoll(0xc2362f);
  private readonly dollB = createDoll(0x2f5fc2);
  private roof: THREE.Object3D | null = null;
  private roofSkin: THREE.Object3D | null = null;
  private ceiling: THREE.Object3D | null = null;

  protected build(_ctx: ExhibitContext): void {
    this.buildRoom();
    this.buildBooth();
    this.placeDolls(0);
    this.root.add(this.dollA, this.dollB);
  }

  private buildRoom(): void {
    const A = APPARENT;
    const w = A.x1 - A.x0;
    const d = A.zFront - A.zBack;
    const hgt = A.y1 - A.y0;
    const surf = (o: V3, u: V3, v: V3, tex: THREE.Texture) => {
      const m = new THREE.Mesh(
        mappedPlane(o, u, v),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }),
      );
      this.root.add(m);
      return m;
    };
    // UV の v は Canvas の上下と逆（下が 0）なので、下端を原点にする
    surf([A.x0, A.y0, A.zFront], [w, 0, 0], [0, 0, -d], canvasTexture(1024, 768, paintFloor));
    this.ceiling = surf(
      [A.x0, A.y1, A.zBack],
      [w, 0, 0],
      [0, 0, d],
      canvasTexture(1024, 768, paintCeiling),
    );
    surf(
      [A.x0, A.y0, A.zBack],
      [w, 0, 0],
      [0, hgt, 0],
      canvasTexture(
        1024,
        576,
        paintWall([
          { x: 0.16, w: 0.2 },
          { x: 0.64, w: 0.2 },
        ]),
      ),
    );
    surf(
      [A.x0, A.y0, A.zFront],
      [0, 0, -d],
      [0, hgt, 0],
      canvasTexture(1024, 768, paintWall([{ x: 0.42, w: 0.26 }])),
    );
    surf(
      [A.x1, A.y0, A.zBack],
      [0, 0, d],
      [0, hgt, 0],
      canvasTexture(1024, 768, paintWall([{ x: 0.32, w: 0.26 }])),
    );
  }

  private buildBooth(): void {
    const B = BOOTH;
    const t = 0.06;
    const inner = new THREE.MeshBasicMaterial({ color: 0x0b0b0c });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf1efea, roughness: 0.85 });
    const band = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.6 });
    const box = (
      x0: number,
      y0: number,
      z0: number,
      x1: number,
      y1: number,
      z1: number,
      m: THREE.Material,
    ) => {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      const mesh = new THREE.Mesh(g, m);
      this.root.add(mesh);
      return mesh;
    };
    // 内側は黒、外側は白い化粧板
    const win = { x0: -0.16, x1: 0.16, y0: 1.49, y1: 1.71 };
    box(B.x0, 0, B.z1 - t, win.x0, B.height, B.z1, inner);
    box(win.x1, 0, B.z1 - t, B.x1, B.height, B.z1, inner);
    box(win.x0, 0, B.z1 - t, win.x1, win.y0, B.z1, inner);
    box(win.x0, win.y1, B.z1 - t, win.x1, B.height, B.z1, inner);
    box(B.x0, 0, B.z0, B.x1, B.height, B.z0 + t, inner);
    box(B.x0, 0, B.z0, B.x0 + t, B.height, B.z1, inner);
    box(B.x1 - t, 0, B.z0, B.x1, B.height, B.z1, inner);
    this.roof = box(B.x0, B.height - t, B.z0, B.x1, B.height, B.z1, inner);

    // 外装: 継ぎ目が出ないよう、各面を 1 枚の板で覆う（正面は覗き窓の穴あき）
    const e = 0.004;
    const W = B.x1 - B.x0;
    const D = B.z1 - B.z0;
    const H = B.height;
    const front = new THREE.Shape();
    front.moveTo(B.x0, 0);
    front.lineTo(B.x1, 0);
    front.lineTo(B.x1, H);
    front.lineTo(B.x0, H);
    front.closePath();
    const hole = new THREE.Path();
    hole.moveTo(win.x0, win.y0);
    hole.lineTo(win.x0, win.y1);
    hole.lineTo(win.x1, win.y1);
    hole.lineTo(win.x1, win.y0);
    hole.closePath();
    front.holes.push(hole);
    const frontMesh = new THREE.Mesh(new THREE.ShapeGeometry(front), skin);
    frontMesh.position.z = B.z1 + e;
    const panel = (w: number, h: number, x: number, y: number, z: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skin);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      this.root.add(m);
      return m;
    };
    this.root.add(frontMesh);
    panel(W, H, (B.x0 + B.x1) / 2, H / 2, B.z0 - e, Math.PI);
    panel(D, H, B.x0 - e, H / 2, (B.z0 + B.z1) / 2, -Math.PI / 2);
    panel(D, H, B.x1 + e, H / 2, (B.z0 + B.z1) / 2, Math.PI / 2);
    const roofSkin = new THREE.Mesh(new THREE.PlaneGeometry(W, D), skin);
    roofSkin.rotation.x = -Math.PI / 2;
    roofSkin.position.set((B.x0 + B.x1) / 2, H + e, (B.z0 + B.z1) / 2);
    this.root.add(roofSkin);
    this.roofSkin = roofSkin;
    // 黒い帯と、覗き窓の縁
    box(B.x0 - 2 * e, 2.05, B.z1, B.x1 + 2 * e, 2.12, B.z1 + 2 * e, band);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.235, 48, 1),
      new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.5, side: THREE.DoubleSide }),
    );
    rim.position.set(0, 1.6, B.z1 + 0.01);
    rim.scale.set(1, 0.72, 1);
    this.root.add(rim);
  }

  /** t: 0 = 初期配置（赤が左、青が右）、1 = 入れ替えた配置 */
  private placeDolls(t: number): void {
    const a = toReal(dollPath(t));
    const b = toReal(dollPath(1 - t));
    this.dollA.position.set(...a);
    this.dollB.position.set(...b);
  }

  private setTopOpen(open: boolean): void {
    if (this.roof) this.roof.visible = !open;
    if (this.roofSkin) this.roofSkin.visible = !open;
    if (this.ceiling) this.ceiling.visible = !open;
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    // 1. 覗き穴から見たまま、人形の左右を入れ替える（大きさが変わって見える）
    if (!(await this.wait(0.6, signal))) return false;
    if (!(await this.animate(3.2, (t) => this.placeDolls(t), signal))) return false;
    if (!(await this.wait(1.5, signal))) return false;
    // 2. 天井を外し、上から部屋の本当の形を見せる
    this.setTopOpen(true);
    const target: V3 = [-0.3, 1.0, -1.45];
    if (
      !(await this.ctx.rig.flyTo(
        { position: [-0.3, 1.6, 0.9], target: [-0.3, 1.2, -1.4] },
        1.2,
        signal,
      ))
    )
      return false;
    if (!(await this.ctx.rig.flyTo({ position: [-0.25, 4.3, -1.2], target, fov: 55 }, 2.2, signal)))
      return false;
    if (!(await this.wait(4.5, signal))) return false;
    if (
      !(await this.ctx.rig.flyTo(
        { position: [-0.3, 1.6, 0.9], target: [-0.3, 1.2, -1.4], fov: 50 },
        2,
        signal,
      ))
    )
      return false;
    this.setTopOpen(false);
    if (!(await this.ctx.rig.returnToView(1.2, signal))) return false;
    return this.animate(2.4, (t) => this.placeDolls(1 - t), signal);
  }

  protected override resetDemo(): void {
    this.setTopOpen(false);
    this.placeDolls(0);
  }

  /** テスト用: 人形の頭頂（展示ローカル座標） */
  get debugPoints(): Record<string, V3> {
    const top = (p: V3): V3 => {
      const r = toReal(p);
      return [r[0], r[1] + DOLL_HEIGHT, r[2]];
    };
    return {
      dollLeftFoot: toReal(DOLL_LEFT),
      dollLeftTop: top(DOLL_LEFT),
      dollRightFoot: toReal(DOLL_RIGHT),
      dollRightTop: top(DOLL_RIGHT),
    };
  }
}
