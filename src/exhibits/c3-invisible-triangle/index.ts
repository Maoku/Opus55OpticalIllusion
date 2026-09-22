import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { rectCollider } from '../../world/collision';
import type { ExhibitContext, Vec3, ViewMode } from '../types';
import { CENTER, EYE, pieces, toLocal } from './design';

/** Zone C の天井高 */
const CEILING = 5;

export class InvisibleTriangleExhibit extends BaseExhibit {
  readonly id = 'invisible-triangle' as const;
  readonly viewMode: ViewMode = { kind: 'fixed', position: EYE, target: CENTER, fov: 34 };
  readonly colliders = [rectCollider(-0.85, 0.4, 0.85, 3.2)];
  readonly captionAnchor = { position: [1.25, 1.05, 3.6] as Vec3, rotationY: -0.3, stand: true };
  readonly debugPoints: Record<string, Vec3> = (() => {
    const out: Record<string, Vec3> = {};
    pieces().forEach((p, i) => {
      // 各パーツの最初の頂点（像の平面の位置と、実際の奥行きの位置）
      const v = p.polygons[0]![1]!;
      out[`piece${i}Plane`] = toLocal(v, 1);
      out[`piece${i}Real`] = toLocal(v, p.k);
    });
    return out;
  })();

  protected build(_ctx: ExhibitContext): void {
    const ink = new THREE.MeshBasicMaterial({ color: 0x131313, side: THREE.DoubleSide });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xc9c9c9 });
    for (const piece of pieces()) {
      const group = new THREE.Group();
      let top = -Infinity;
      let topPoint: Vec3 = [0, 0, 0];
      for (const poly of piece.polygons) {
        const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ShapeGeometry(shape, 24);
        const pos = g.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          const p = toLocal([pos.getX(i), pos.getY(i)], piece.k);
          pos.setXYZ(i, p[0], p[1], p[2]);
          if (p[1] > top) {
            top = p[1];
            topPoint = p;
          }
        }
        g.computeBoundingSphere();
        group.add(new THREE.Mesh(g, ink));
      }
      // 天井から吊るす細いワイヤー
      const len = CEILING - top;
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, len, 4), wireMat);
      wire.position.set(topPoint[0], top + len / 2, topPoint[2]);
      group.add(wire);
      group.name = piece.kind;
      this.root.add(group);
    }
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    if (!(await this.wait(0.5, signal))) return false;
    const ok = await this.ctx.rig.flyTo(
      { position: [2.8, 1.9, 2.6], target: [0, 1.75, 1.8], via: [2.2, 1.8, 4.4], fov: 40 },
      3,
      signal,
    );
    if (!ok) return false;
    if (!(await this.wait(4.5, signal))) return false;
    return this.ctx.rig.returnToView(2.6, signal);
  }
}
