import { describe, expect, it } from 'vitest';
import {
  EYE,
  FRUSTUMS,
  LOOK_AT,
  frustumCorners,
  intersect,
  streetFrame,
  type P2,
} from '../../src/exhibits/b4-reverspective/design';
import { lookBasis, projectFrom } from '../../src/exhibits/common/viewpoint';

const basis = lookBasis([EYE.x, EYE.y, EYE.z], [LOOK_AT.x, LOOK_AT.y, LOOK_AT.z]);
const proj = (p: { x: number; y: number; z: number }): P2 => {
  const q = projectFrom(basis, [p.x, p.y, p.z]);
  return { x: q.x, y: q.y };
};

describe('B-4 逆遠近の設計', () => {
  it('角錐台は手前に突き出している（前面のほうが視点に近い）', () => {
    for (const f of FRUSTUMS) {
      const c = frustumCorners(f);
      expect(c.front[0]!.z).toBeGreaterThan(c.back[0]!.z);
      expect(f.front.w).toBeLessThan(f.back.w);
    }
  });

  it('推奨視点から見ると、4 本の稜線の像が 1 点（消失点）で交わる', () => {
    for (const f of FRUSTUMS) {
      const c = frustumCorners(f);
      const qb = c.back.map(proj);
      const qf = c.front.map(proj);
      const vp = streetFrame(qb, qf).vp;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const p = intersect(qb[i]!, qf[i]!, qb[j]!, qf[j]!);
        expect(Math.hypot(p.x - vp.x, p.y - vp.y)).toBeLessThan(1e-9);
      }
    }
  });

  it('奥行きの縮尺は手前で 1、最も奥で前面の縮尺になる', () => {
    const f = FRUSTUMS[0]!;
    const c = frustumCorners(f);
    const s = streetFrame(c.back.map(proj), c.front.map(proj));
    expect(s.lambda(0)).toBeCloseTo(1, 12);
    expect(s.lambda(1)).toBeCloseTo(s.lf, 12);
    expect(s.lf).toBeGreaterThan(0);
    expect(s.lf).toBeLessThan(1);
  });
});
