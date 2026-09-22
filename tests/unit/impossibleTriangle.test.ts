import { describe, expect, it } from 'vitest';
import {
  BASIS,
  CORNER_A,
  CORNER_E,
  L,
  beams,
  toLocal,
} from '../../src/exhibits/b2-impossible-triangle/shape';
import { projectFrom } from '../../src/exhibits/common/viewpoint';

describe('B-2 ペンローズの三角形', () => {
  it('途切れた両端 A と E は、P からの透視で同じ点に重なる', () => {
    const a = projectFrom(BASIS, toLocal(CORNER_A));
    const e = projectFrom(BASIS, toLocal(CORNER_E));
    expect(Math.abs(a.x - e.x)).toBeLessThan(1e-9);
    expect(Math.abs(a.y - e.y)).toBeLessThan(1e-9);
    // E のほうが手前にあり、A を隠す
    expect(e.depth).toBeLessThan(a.depth);
  });

  it('角の立方体全体（8 頂点）が重なる', () => {
    const h = 0.07;
    for (const dx of [-h, h]) {
      for (const dy of [-h, h]) {
        for (const dz of [-h, h]) {
          const a = projectFrom(BASIS, toLocal([dx, dy, dz]));
          const e = projectFrom(BASIS, toLocal([L + dx, L + dy, L + dz]));
          expect(Math.abs(a.x - e.x)).toBeLessThan(1e-9);
          expect(Math.abs(a.y - e.y)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('3 本の角材は x・y・z の順に直角につながる', () => {
    const b = beams();
    expect(b.map((x) => x.axis)).toEqual([0, 1, 2]);
    expect(b[0]!.max[0]).toBeCloseTo(b[1]!.max[0]);
    expect(b[1]!.max[1]).toBeCloseTo(b[2]!.max[1]);
  });
});
