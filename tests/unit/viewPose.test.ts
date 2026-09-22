import { describe, expect, it } from 'vitest';
import {
  FRONT_FILL,
  focalFromFov,
  frontDistance,
  localViewPose,
  projectedSize,
} from '../../src/exhibits/viewPose';
import { transformCollider } from '../../src/exhibits/ExhibitManager';

describe('鑑賞距離', () => {
  it('作品が空いている領域の 70% を占める距離になる', () => {
    const focal = focalFromFov(42, 720);
    const freeW = 1280 - 392;
    const d = frontDistance(2.6, 2.0, focal, freeW, 720);
    const s = projectedSize(2.6, 2.0, d, focal);
    expect(Math.max(s.w / freeW, s.h / 720)).toBeCloseTo(FRONT_FILL, 6);
    expect(s.w / freeW).toBeLessThanOrEqual(FRONT_FILL + 1e-9);
    expect(s.h / 720).toBeLessThanOrEqual(FRONT_FILL + 1e-9);
  });

  it('front: 作品の正面（+Z）にカメラを置き、中心を見る', () => {
    const pose = localViewPose(
      { kind: 'front', center: [0, 1.6, 0.04], width: 2, height: 1.5 },
      { width: 1280, height: 720, insetRight: 392, insetBottom: 0 },
    );
    expect(pose.position[0]).toBe(0);
    expect(pose.position[1]).toBe(1.6);
    expect(pose.position[2]).toBeGreaterThan(1);
    expect(pose.target).toEqual([0, 1.6, 0.04]);
  });

  it('fixed: 指定した視点をそのまま使う', () => {
    const pose = localViewPose(
      { kind: 'fixed', position: [1, 1.6, 4], target: [0, 1, 0], fov: 30 },
      { width: 1280, height: 720, insetRight: 0, insetBottom: 0 },
    );
    expect(pose).toEqual({ position: [1, 1.6, 4], target: [0, 1, 0], fov: 30 });
  });
});

describe('transformCollider', () => {
  it('90° 回転した矩形を外接矩形に直す', () => {
    const c = transformCollider(
      { kind: 'rect', x0: -1, z0: -0.5, x1: 1, z1: 0.5 },
      { x: 10, z: 20, rotation: Math.PI / 2 },
    );
    expect(c.kind).toBe('rect');
    if (c.kind !== 'rect') return;
    expect(c.x0).toBeCloseTo(9.5);
    expect(c.x1).toBeCloseTo(10.5);
    expect(c.z0).toBeCloseTo(19);
    expect(c.z1).toBeCloseTo(21);
  });

  it('展示の正面（+Z）は rotation に応じた向きになる', () => {
    const c = transformCollider(
      { kind: 'circle', x: 0, z: 1, r: 0.2 },
      { x: 0, z: 0, rotation: Math.PI / 2 },
    );
    expect(c.kind).toBe('circle');
    if (c.kind !== 'circle') return;
    // π/2 で東（+X）を向く
    expect(c.x).toBeCloseTo(1);
    expect(c.z).toBeCloseTo(0);
  });
});
