import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { BaseExhibit } from '../common/BaseExhibit';
import { QUALITY_PRESETS } from '../../core/renderer';
import { rectCollider } from '../../world/collision';
import type { ExhibitContext, Vec3, ViewMode } from '../types';
import type { V3 } from '../common/viewpoint';
import { solveRim, type Rim } from './solver';

/** 設計（展示ローカル座標。正面 +z に視点がある） */
export const C1 = {
  eye: [0, 1.6, 1.8] as V3,
  mirrorZ: -0.35,
  target: [0, 0.3, 0] as V3,
  radius: 0.1,
  plinthTop: 0.15,
};

export function solveC1(): Rim {
  return solveRim({ eyeA: C1.eye, mirrorZ: C1.mirrorZ, target: C1.target, radius: C1.radius });
}

/** 上縁から真下へ下ろした筒の側面 */
function wallGeometry(rim: V3[], bottom: number): THREE.BufferGeometry {
  // 上から見て時計回りにそろえる（三角形の表が外側を向くように）
  let area = 0;
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i]!;
    const b = rim[(i + 1) % rim.length]!;
    area += a[0] * b[2] - b[0] * a[2];
  }
  const loop = area > 0 ? [...rim].reverse() : rim;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const p of loop) pos.push(p[0], p[1], p[2], p[0], bottom, p[2]);
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const t0 = i * 2;
    const b0 = t0 + 1;
    const t1 = ((i + 1) % n) * 2;
    const b1 = t1 + 1;
    idx.push(t0, b0, t1, t1, b0, b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class CircleHeartExhibit extends BaseExhibit {
  readonly id = 'circle-heart' as const;
  readonly viewMode: ViewMode = {
    kind: 'fixed',
    position: C1.eye,
    target: [0, 0.31, -0.3],
    fov: 24,
  };
  readonly colliders = [rectCollider(-0.55, C1.mirrorZ - 0.08, 0.55, 0.32)];
  readonly captionAnchor = { position: [0.75, 1.05, 0.2] as Vec3, rotationY: -0.35, stand: true };
  private readonly spinner = new THREE.Group();
  private mirror: Reflector | null = null;
  private mirrorStandIn: THREE.Mesh | null = null;

  get debugPoints(): Record<string, Vec3> {
    return { tubeCenter: C1.target };
  }

  protected build(ctx: ExhibitContext): void {
    const rim = solveC1();

    // 低い台
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, C1.plinthTop, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.7 }),
    );
    plinth.position.set(0, C1.plinthTop / 2, 0);
    this.root.add(plinth);

    // 筒（外側は白、内側は色をつけて縁の形をはっきりさせる）
    const wall = wallGeometry(rim.points, C1.plinthTop);
    const outer = new THREE.Mesh(
      wall,
      new THREE.MeshStandardMaterial({ color: 0xf3f0e9, roughness: 0.45 }),
    );
    const inner = new THREE.Mesh(
      wall,
      new THREE.MeshStandardMaterial({ color: 0xe46a4f, roughness: 0.6, side: THREE.BackSide }),
    );
    const curve = new THREE.CatmullRomCurve3(
      rim.points.map((p) => new THREE.Vector3(...p)),
      true,
      'centripetal',
    );
    const lip = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 480, 0.0035, 8, true),
      new THREE.MeshStandardMaterial({ color: 0x1b2552, roughness: 0.4 }),
    );
    // 回転台（デモ用）: 筒の中心の鉛直軸まわりに回す
    this.spinner.position.set(C1.target[0], 0, C1.target[2]);
    for (const m of [outer, inner, lip]) {
      m.position.set(-C1.target[0], 0, -C1.target[2]);
      this.spinner.add(m);
    }
    this.root.add(this.spinner);

    // 鏡
    const mw = 0.9;
    const mh = 0.85;
    const size = new THREE.Vector2();
    ctx.renderer.getDrawingBufferSize(size);
    const k = QUALITY_PRESETS[ctx.quality].reflectorScale;
    this.mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), {
      clipBias: 0.003,
      textureWidth: Math.max(256, Math.round(size.x * k)),
      textureHeight: Math.max(256, Math.round(size.y * k)),
      color: 0xe9eeee,
    });
    this.mirror.position.set(0, 0.1 + mh / 2, C1.mirrorZ);
    this.mirror.visible = false;
    this.mirrorStandIn = new THREE.Mesh(
      new THREE.PlaneGeometry(mw, mh),
      new THREE.MeshStandardMaterial({ color: 0x9aa2a6, metalness: 0.9, roughness: 0.15 }),
    );
    this.mirrorStandIn.position.copy(this.mirror.position);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(mw + 0.06, mh + 0.06, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.5 }),
    );
    frame.position.set(0, 0.1 + mh / 2, C1.mirrorZ - 0.021);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(mw + 0.06, 0.1, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.5 }),
    );
    foot.position.set(0, 0.05, C1.mirrorZ - 0.04);
    this.root.add(this.mirror, this.mirrorStandIn, frame, foot);
  }

  /** 近くにいるときだけ鏡の映り込みを描く（離れているときは金属の板で代用する） */
  setActive(active: boolean): void {
    if (this.mirror) this.mirror.visible = active;
    if (this.mirrorStandIn) this.mirrorStandIn.visible = !active;
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    if (!(await this.wait(0.6, signal))) return false;
    // 1. 筒を 180° 回すと、実物と鏡の形が入れ替わる
    if (!(await this.animate(3.2, (t) => (this.spinner.rotation.y = Math.PI * t), signal)))
      return false;
    if (!(await this.wait(3.2, signal))) return false;
    if (!(await this.animate(2.4, (t) => (this.spinner.rotation.y = Math.PI * (1 - t)), signal)))
      return false;
    // 2. 真上から本当の形を見る
    const ok = await this.ctx.rig.flyTo(
      { position: [0, 1.25, 0.02], target: [0, 0.2, 0], fov: 30 },
      2.4,
      signal,
    );
    if (!ok) return false;
    if (!(await this.wait(4, signal))) return false;
    return this.ctx.rig.returnToView(2.2, signal);
  }

  protected override resetDemo(): void {
    this.spinner.rotation.y = 0;
  }

  override dispose(): void {
    super.dispose();
    this.mirror?.dispose();
  }
}
