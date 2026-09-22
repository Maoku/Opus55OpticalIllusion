import { describe, expect, it } from 'vitest';
import {
  homology,
  lookBasis,
  orthoImage,
  orthoToPerspective,
  placeOnRay,
  planeDistance,
  projectFrom,
  type V3,
} from '../../src/exhibits/common/viewpoint';

const EYE: V3 = [0.3, 1.6, 4];
const basis = lookBasis(EYE, [0, 1.2, 0]);

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('placeOnRay（光線上配置）', () => {
  it('P からの投影は変わらない', () => {
    const r = rand(1);
    for (let i = 0; i < 50; i++) {
      const v: V3 = [r() * 2 - 1, r() * 2, r() * 2 - 1];
      const k = 0.4 + r() * 2;
      const a = projectFrom(basis, v);
      const b = projectFrom(basis, placeOnRay(EYE, v, k));
      expect(Math.abs(a.x - b.x)).toBeLessThan(1e-6);
      expect(Math.abs(a.y - b.y)).toBeLessThan(1e-6);
      expect(b.depth / a.depth).toBeCloseTo(k, 9);
    }
  });
});

describe('homology（透視的共線変換）', () => {
  const a: V3 = [0.45, 0.05, -0.02];
  const b = 1;

  it('P からの投影は変わらない（誤差 1e-6 未満）', () => {
    const r = rand(2);
    for (let i = 0; i < 50; i++) {
      const v: V3 = [r() - 0.5, 1 + r(), -0.5 - r()];
      const p = projectFrom(basis, v);
      const q = projectFrom(basis, homology(EYE, a, b, v));
      expect(Math.abs(p.x - q.x)).toBeLessThan(1e-6);
      expect(Math.abs(p.y - q.y)).toBeLessThan(1e-6);
    }
  });

  it('平面は平面のまま', () => {
    const r = rand(3);
    // z = -1.2 の平面上の点
    const pts: V3[] = Array.from({ length: 12 }, () => [r() - 0.5, 1 + r(), -1.2]);
    const h = pts.map((p) => homology(EYE, a, b, p));
    for (let i = 3; i < h.length; i++) {
      expect(planeDistance(h[0]!, h[1]!, h[2]!, h[i]!)).toBeLessThan(1e-9);
    }
  });

  it('分母が 0 以下になる点は拒否する', () => {
    expect(() => homology(EYE, [10, 0, 0], 1, [-5, 1.6, 0])).toThrow();
  });
});

describe('orthoToPerspective（正射影で設計した形の補正）', () => {
  it('P から見た透視像が、正射影の像を d0 で割ったものに一致する', () => {
    const d0 = 4.2;
    const r = rand(4);
    for (let i = 0; i < 50; i++) {
      const v: V3 = [r() - 0.5, 1 + r(), r() - 0.5];
      const o = orthoImage(basis, v);
      const p = projectFrom(basis, orthoToPerspective(basis, d0, v));
      expect(Math.abs(p.x - o.x / d0)).toBeLessThan(1e-9);
      expect(Math.abs(p.y - o.y / d0)).toBeLessThan(1e-9);
    }
  });

  it('視線方向の距離は保つ', () => {
    const v: V3 = [0.2, 1.4, -0.3];
    const a = projectFrom(basis, v).depth;
    const b = projectFrom(basis, orthoToPerspective(basis, 4, v)).depth;
    expect(b).toBeCloseTo(a, 12);
  });
});
