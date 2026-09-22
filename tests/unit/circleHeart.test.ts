import { describe, expect, it } from 'vitest';
import { C1, solveC1 } from '../../src/exhibits/c1-circle-heart';
import { distanceToPolygon, imageOf, mirrorEye } from '../../src/exhibits/c1-circle-heart/solver';

describe('C-1 円とハートのあいだ（曲線ソルバ）', () => {
  const rim = solveC1();
  const r = Math.hypot(...rim.circle[0]!);

  it('視点 A から見た上縁は円に一致する', () => {
    for (const p of rim.points) {
      expect(distanceToPolygon(imageOf(rim.basisA, p), rim.circle)).toBeLessThan(r * 1e-6);
    }
  });

  it('鏡に映った視点 B から見た上縁はハートに一致する', () => {
    for (const p of rim.points) {
      expect(distanceToPolygon(imageOf(rim.basisB, p), rim.heart)).toBeLessThan(r * 1e-6);
    }
  });

  it('B は A を鏡の面で折り返した位置にある', () => {
    expect(rim.eyeB).toEqual(mirrorEye(C1.eye, C1.mirrorZ));
  });

  it('上縁は閉じていて、上から見て自己交差しない（手前の枝が常に奥の枝より手前）', () => {
    expect(rim.near.length).toBe(rim.far.length);
    for (let i = 0; i < rim.near.length; i++) {
      expect(rim.near[i]![2]).toBeGreaterThanOrEqual(rim.far[i]![2] - 1e-9);
    }
    const first = rim.near[0]!;
    const last = rim.far[0]!;
    expect(Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2])).toBeLessThan(
      0.01,
    );
  });

  it('筒は台の上、鏡の手前に収まる', () => {
    for (const p of rim.points) {
      expect(p[1]).toBeGreaterThan(C1.plinthTop + 0.05);
      expect(p[2]).toBeGreaterThan(C1.mirrorZ + 0.08);
      expect(Math.abs(p[0])).toBeLessThan(0.3);
    }
  });
});
