import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  EXHIBIT_PLACEMENTS,
  FURNITURE,
  PLAYER_RADIUS,
  ROOMS,
  SPAWN,
  bounds,
  computeWalls,
  roomAt,
} from '../../src/world/layout';
import { CollisionWorld, rectCollider } from '../../src/world/collision';
import { floodReachable } from '../../src/world/navigation';
import { ExhibitManager } from '../../src/exhibits/ExhibitManager';
import { EXHIBIT_IDS } from '../../src/content/types';
import type { ExhibitContext } from '../../src/exhibits/types';

const VIEWPORT = { width: 1280, height: 720, insetRight: 392, insetBottom: 0 };

function setup() {
  const world = new CollisionWorld();
  for (const p of computeWalls(ROOMS)) {
    if (p.y0 < 0.5) world.add(rectCollider(p.rect.x0, p.rect.z0, p.rect.x1, p.rect.z1));
  }
  for (const f of FURNITURE)
    world.add(rectCollider(f.x - 1.25, f.z - 1.25, f.x + 1.25, f.z + 1.25));
  const wallCount = world.colliders.length;
  const manager = new ExhibitManager(new THREE.Scene(), world, () => ({}) as ExhibitContext);
  return { world, manager, wallCount };
}

describe('展示の配置', () => {
  it('すべての展示 ID がちょうど 1 回ずつ配置されている', () => {
    const ids = EXHIBIT_PLACEMENTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...EXHIBIT_IDS].sort());
  });

  it('配置位置は館内にある', () => {
    for (const p of EXHIBIT_PLACEMENTS) expect(roomAt(p.x, p.z), p.id).toBeDefined();
  });

  const { world, manager, wallCount } = setup();
  const reachable = floodReachable(world, bounds(ROOMS), { x: SPAWN.x, z: SPAWN.z }, PLAYER_RADIUS);

  it.each(manager.ids().map((id) => [id]))('%s: 鑑賞位置へ入口から歩いて行ける', (id) => {
    const stand = manager.standPoint(id, VIEWPORT);
    const p = world.resolve({ x: stand.x, z: stand.z }, PLAYER_RADIUS);
    expect(reachable(p)).toBe(true);
  });

  it('展示の障害物は壁や家具と重ならない', () => {
    const exhibitColliders = world.colliders.slice(wallCount);
    const walls = world.colliders.slice(0, wallCount);
    for (const c of exhibitColliders) {
      for (const w of walls) {
        if (c.kind !== 'rect' || w.kind !== 'rect') continue;
        const ox = Math.min(c.x1, w.x1) - Math.max(c.x0, w.x0);
        const oz = Math.min(c.z1, w.z1) - Math.max(c.z0, w.z0);
        expect(ox > 0.01 && oz > 0.01).toBe(false);
      }
    }
  });

  it('前後の作品は順路の順に一周する', () => {
    const ids = manager.ids();
    const first = ids[0]!;
    expect(manager.neighbors(first).prev).toBe(ids[ids.length - 1]);
    if (ids.length > 1) expect(manager.neighbors(first).next).toBe(ids[1]);
  });
});
