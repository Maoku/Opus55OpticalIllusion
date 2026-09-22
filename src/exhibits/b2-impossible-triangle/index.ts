import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { createPedestal } from '../common/frame';
import { rectCollider } from '../../world/collision';
import type { ExhibitContext, Vec3, ViewMode } from '../types';
import type { V3 } from '../common/viewpoint';
import { CORNER_A, CORNER_E, EYE, FOV, L, TARGET, W, beams, toLocal } from './shape';

const PEDESTAL_TOP = 0.95;

/** 面の向きごとの色（陰影を焼き込む。視点を変えても同じ色） */
const FACE_COLORS: Record<string, number> = {
  '+y': 0xeadfcb,
  '+x': 0xb99f7c,
  '+z': 0x7a6651,
  '-y': 0x5e5042,
  '-x': 0x8f7a60,
  '-z': 0xa48d6f,
};

/** 彫刻座標の直方体を細かく分割し、各頂点を toLocal で写したジオメトリ（頂点カラー付き） */
function beamGeometry(min: V3, max: V3, axis: number): THREE.BufferGeometry {
  const size: V3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const segs: V3 = [2, 2, 2];
  segs[axis] = 18;
  const g = new THREE.BoxGeometry(size[0], size[1], size[2], segs[0], segs[1], segs[2]);
  g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const n = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    const k = n.findIndex((v) => Math.abs(v) > 0.5);
    const key = `${n[k]! > 0 ? '+' : '-'}${'xyz'[k]}`;
    c.set(FACE_COLORS[key]!);
    colors.set([c.r, c.g, c.b], i * 3);
    const p = toLocal([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    pos.setXYZ(i, p[0], p[1], p[2]);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g.computeBoundingSphere();
  return g;
}

export class ImpossibleTriangleExhibit extends BaseExhibit {
  readonly id = 'impossible-triangle' as const;
  readonly viewMode: ViewMode = { kind: 'fixed', position: EYE, target: TARGET, fov: FOV };
  readonly colliders = [rectCollider(-0.4, -0.4, 0.4, 0.4)];
  readonly captionAnchor = { position: [0, 0.72, 0.356] as Vec3 };
  readonly debugPoints: Record<string, Vec3> = {
    cornerA: toLocal(CORNER_A),
    cornerE: toLocal(CORNER_E),
  };

  protected build(_ctx: ExhibitContext): void {
    this.root.add(createPedestal(0.7, 0.7, PEDESTAL_TOP));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    for (const b of beams()) {
      const mesh = new THREE.Mesh(beamGeometry(b.min, b.max, b.axis), mat);
      mesh.name = 'beam';
      this.root.add(mesh);
    }
    // 支柱: 最初の角材の中ほどの下面から台座へ
    const base = toLocal([L / 2, -W / 2, 0]);
    const h = base[1] - PEDESTAL_TOP;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, h, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: 0.7, roughness: 0.4 }),
    );
    rod.position.set(base[0], PEDESTAL_TOP + h / 2, base[2]);
    this.root.add(rod);
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    if (!(await this.wait(0.4, signal))) return false;
    const ok = await this.ctx.rig.flyTo(
      { position: [3.4, 2.1, 1.3], target: TARGET, via: [3.6, 2.0, 4.2], fov: 30 },
      3,
      signal,
    );
    if (!ok) return false;
    if (!(await this.wait(4.5, signal))) return false;
    return this.ctx.rig.returnToView(2.4, signal);
  }
}
