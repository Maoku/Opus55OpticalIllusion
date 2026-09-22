import { describe, expect, it } from 'vitest';
import { BASIS, D0, pieces, toLocal } from '../../src/exhibits/c3-invisible-triangle/design';
import { projectFrom } from '../../src/exhibits/common/viewpoint';

describe('C-3 見えない三角形', () => {
  const ps = pieces();

  it('欠けた円盤 3 枚と V 字 3 つ', () => {
    expect(ps.filter((p) => p.kind === 'pacman')).toHaveLength(3);
    expect(ps.filter((p) => p.kind === 'vee')).toHaveLength(3);
  });

  it('各パーツは別々の奥行きにある', () => {
    expect(new Set(ps.map((p) => p.k)).size).toBe(ps.length);
  });

  it('P から見ると、どのパーツも像の平面の設計どおりの位置に見える（光線上配置）', () => {
    for (const p of ps) {
      for (const poly of p.polygons) {
        for (const v of poly) {
          const q = projectFrom(BASIS, toLocal(v, p.k));
          expect(Math.abs(q.x - v[0] / D0)).toBeLessThan(1e-9);
          expect(Math.abs(q.y - v[1] / D0)).toBeLessThan(1e-9);
          expect(q.depth).toBeCloseTo(D0 * p.k, 9);
        }
      }
    }
  });

  it('パーツは壁（z = 0）より手前に浮いている', () => {
    for (const p of ps) {
      for (const poly of p.polygons)
        for (const v of poly) expect(toLocal(v, p.k)[2]).toBeGreaterThan(0.3);
    }
  });
});
