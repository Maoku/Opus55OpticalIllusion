import { describe, expect, it } from 'vitest';
import { CollisionWorld, rectCollider } from '../../src/world/collision';

const R = 0.3;

function worldWithWall() {
  const w = new CollisionWorld();
  // x = 0 の位置にある厚さ 0.3 の縦の壁
  w.add(rectCollider(0, -10, 0.3, 10));
  return w;
}

describe('CollisionWorld', () => {
  it('何もなければそのまま移動する', () => {
    const w = new CollisionWorld();
    const p = w.move({ x: 0, z: 0 }, { x: 1, z: 2 }, R);
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.z).toBeCloseTo(2, 9);
  });

  it('壁に斜めにぶつかると、壁に沿ってスライドする', () => {
    const w = worldWithWall();
    const p = w.move({ x: -1, z: 0 }, { x: 2, z: 1 }, R);
    expect(p.x).toBeCloseTo(-R, 5);
    expect(p.z).toBeCloseTo(1, 5);
  });

  it('速く動いても壁を突き抜けない（トンネリングしない）', () => {
    const w = worldWithWall();
    const p = w.move({ x: -1, z: 0 }, { x: 50, z: 0 }, R);
    expect(p.x).toBeLessThanOrEqual(-R + 1e-6);
  });

  it('2 枚の壁の角（L 字）をすり抜けない', () => {
    const w = new CollisionWorld();
    w.add(rectCollider(0, -5, 0.3, 0.3)); // 縦の壁
    w.add(rectCollider(-5, 0, 0.3, 0.3)); // 横の壁
    const p = w.move({ x: -1, z: -1 }, { x: 3, z: 3 }, R);
    expect(p.x).toBeLessThanOrEqual(-R + 1e-6);
    expect(p.z).toBeLessThanOrEqual(-R + 1e-6);
  });

  it('壁の隙間が体より狭ければ通れない', () => {
    const w = new CollisionWorld();
    w.add(rectCollider(-5, 0, -0.2, 0.3));
    w.add(rectCollider(0.2, 0, 5, 0.3));
    const p = w.move({ x: 0, z: -1 }, { x: 0, z: 3 }, R);
    expect(p.z).toBeLessThan(0);
  });

  it('壁の隙間が体より広ければ通れる', () => {
    const w = new CollisionWorld();
    w.add(rectCollider(-5, 0, -0.5, 0.3));
    w.add(rectCollider(0.5, 0, 5, 0.3));
    const p = w.move({ x: 0, z: -1 }, { x: 0, z: 3 }, R);
    expect(p.z).toBeCloseTo(2, 5);
  });

  it('円形の障害物のまわりを回り込む', () => {
    const w = new CollisionWorld();
    w.add({ kind: 'circle', x: 0, z: 0, r: 1 });
    const p = w.move({ x: -3, z: 0.2 }, { x: 3, z: 0 }, R);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(1 + R - 1e-6);
  });

  it('めり込んだ位置は押し出される', () => {
    const w = worldWithWall();
    const p = w.resolve({ x: 0.1, z: 0 }, R);
    expect(w.hits(p, R - 1e-6)).toBe(false);
  });
});
