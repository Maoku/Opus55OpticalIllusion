import { describe, expect, it } from 'vitest';
import {
  APPARENT,
  BOOTH,
  DOLL_LEFT,
  DOLL_RIGHT,
  PEEPHOLE,
  depthFactor,
  toReal,
} from '../../src/exhibits/b1-ames-room/room';
import {
  lookBasis,
  planeDistance,
  projectFrom,
  type V3,
} from '../../src/exhibits/common/viewpoint';

const A = APPARENT;
const corners: V3[] = [];
for (const x of [A.x0, A.x1])
  for (const y of [A.y0, A.y1]) for (const z of [A.zFront, A.zBack]) corners.push([x, y, z]);

describe('B-1 エイムズの部屋', () => {
  const basis = lookBasis(PEEPHOLE, [0, 1.33, -1.7]);

  it('覗き穴から見た像は、見かけの直方体の部屋と一致する', () => {
    for (const c of corners) {
      const p = projectFrom(basis, c);
      const q = projectFrom(basis, toReal(c));
      expect(Math.abs(p.x - q.x)).toBeLessThan(1e-6);
      expect(Math.abs(p.y - q.y)).toBeLessThan(1e-6);
    }
  });

  it('奥の壁は平面のまま、斜めに傾く', () => {
    const back = [
      [A.x0, A.y0, A.zBack],
      [A.x1, A.y0, A.zBack],
      [A.x0, A.y1, A.zBack],
      [A.x1, A.y1, A.zBack],
    ].map((p) => toReal(p as V3));
    expect(planeDistance(back[0]!, back[1]!, back[2]!, back[3]!)).toBeLessThan(1e-9);
    // 左の隅は右の隅より 1 m 以上遠い
    expect(back[1]![2] - back[0]![2]).toBeGreaterThan(1);
  });

  it('左の人形は右の人形より 2 倍以上遠くにある', () => {
    expect(depthFactor(DOLL_LEFT) / depthFactor(DOLL_RIGHT)).toBeGreaterThan(2);
  });

  it('歪んだ部屋はブースの中に収まり、床より上にある', () => {
    for (const c of corners) {
      const r = toReal(c);
      expect(r[0]).toBeGreaterThan(BOOTH.x0 + 0.06);
      expect(r[0]).toBeLessThan(BOOTH.x1 - 0.06);
      expect(r[2]).toBeGreaterThan(BOOTH.z0 + 0.06);
      expect(r[2]).toBeLessThan(BOOTH.z1);
      expect(r[1]).toBeGreaterThan(0);
      expect(r[1]).toBeLessThan(BOOTH.height - 0.06);
    }
  });
});
