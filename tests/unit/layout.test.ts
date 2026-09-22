import { describe, expect, it } from 'vitest';
import {
  FURNITURE,
  PLAYER_RADIUS,
  ROOMS,
  SPAWN,
  WALL_THICKNESS,
  bounds,
  computeWalls,
  openingsOf,
  roomAt,
  sidesOf,
  subtractIntervals,
  subtractRects,
} from '../../src/world/layout';
import { CollisionWorld, rectCollider } from '../../src/world/collision';
import { floodReachable } from '../../src/world/navigation';

function wallWorld(): CollisionWorld {
  const w = new CollisionWorld();
  for (const p of computeWalls(ROOMS)) {
    if (p.y0 < 0.5) w.add(rectCollider(p.rect.x0, p.rect.z0, p.rect.x1, p.rect.z1));
  }
  for (const f of FURNITURE) {
    // 家具は大きめに見積もる
    w.add(rectCollider(f.x - 1.9, f.z - 1.9, f.x + 1.9, f.z + 1.9));
  }
  return w;
}

describe('subtractIntervals', () => {
  it('穴を取り除いた区間を返す', () => {
    expect(
      subtractIntervals({ a: 0, b: 10 }, [
        { a: 2, b: 3 },
        { a: 5, b: 7 },
      ]),
    ).toEqual([
      { a: 0, b: 2 },
      { a: 3, b: 5 },
      { a: 7, b: 10 },
    ]);
  });
  it('区間全体が穴なら空', () => {
    expect(subtractIntervals({ a: 0, b: 4 }, [{ a: -1, b: 5 }])).toEqual([]);
  });
});

describe('subtractRects', () => {
  it('中央の穴を除いた面積が正しい', () => {
    const parts = subtractRects({ x0: 0, z0: 0, x1: 10, z1: 10 }, [{ x0: 3, z0: 3, x1: 7, z1: 7 }]);
    const area = parts.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
    expect(area).toBeCloseTo(100 - 16);
  });
});

describe('ROOMS', () => {
  it('部屋 ID が重複しない', () => {
    const ids = ROOMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('部屋どうしが重ならない', () => {
    for (const a of ROOMS) {
      for (const b of ROOMS) {
        if (a === b) continue;
        const ox = Math.min(a.rect.x1, b.rect.x1) - Math.max(a.rect.x0, b.rect.x0);
        const oz = Math.min(a.rect.z1, b.rect.z1) - Math.max(a.rect.z0, b.rect.z0);
        expect(ox > 1e-6 && oz > 1e-6, `${a.id} と ${b.id} が重なっている`).toBe(false);
      }
    }
  });

  it('中央ホールは 4 方向（入口・A・B・C）とつながっている', () => {
    const hall = ROOMS.find((r) => r.id === 'hall')!;
    const others = sidesOf(hall).flatMap((s) =>
      openingsOf(hall, s, ROOMS).map((o) => o.otherRoomId),
    );
    expect(others.sort()).toEqual(['corridor-a', 'corridor-b', 'corridor-c', 'entrance']);
  });

  it('開口部は人が通れる幅がある', () => {
    for (const room of ROOMS) {
      for (const side of sidesOf(room)) {
        for (const op of openingsOf(room, side, ROOMS)) {
          expect(op.b - op.a).toBeGreaterThanOrEqual(1.2);
          expect(op.height).toBeGreaterThanOrEqual(2.2);
        }
      }
    }
  });
});

describe('computeWalls', () => {
  const walls = computeWalls(ROOMS);

  it('壁は部屋の内側に食い込まない', () => {
    for (const w of walls) {
      if (w.y0 > 0.5) continue;
      const cx = (w.rect.x0 + w.rect.x1) / 2;
      const cz = (w.rect.z0 + w.rect.z1) / 2;
      const inside = ROOMS.find(
        (r) =>
          cx > r.rect.x0 + 1e-6 &&
          cx < r.rect.x1 - 1e-6 &&
          cz > r.rect.z0 + 1e-6 &&
          cz < r.rect.z1 - 1e-6,
      );
      expect(inside, `${w.roomId}/${w.side} の壁が ${inside?.id} の内側にある`).toBeUndefined();
    }
  });

  it('壁の厚みは一定', () => {
    for (const w of walls) {
      if (w.kind === 'corner') continue;
      const t = Math.min(w.rect.x1 - w.rect.x0, w.rect.z1 - w.rect.z0);
      expect(t).toBeCloseTo(WALL_THICKNESS);
    }
  });

  it('高さの違う部屋の開口部には垂れ壁がある', () => {
    const lintel = walls.find(
      (w) => w.roomId === 'hall' && w.kind === 'lintel' && w.side === 'west',
    );
    expect(lintel).toBeDefined();
    expect(lintel!.y0).toBe(4);
  });
});

describe('歩行の到達性', () => {
  const world = wallWorld();
  const area = bounds(ROOMS);
  const reachable = floodReachable(world, area, { x: SPAWN.x, z: SPAWN.z }, PLAYER_RADIUS);

  it('入口の位置は壁に重ならない', () => {
    expect(world.hits({ x: SPAWN.x, z: SPAWN.z }, PLAYER_RADIUS)).toBe(false);
    expect(roomAt(SPAWN.x, SPAWN.z)?.id).toBe('entrance');
  });

  it.each(ROOMS.filter((r) => r.id !== 'darkroom-door').map((r) => [r.id, r] as const))(
    '入口から %s へ歩いて行ける',
    (_id, room) => {
      const c = { x: (room.rect.x0 + room.rect.x1) / 2, z: (room.rect.z0 + room.rect.z1) / 2 };
      expect(reachable(c)).toBe(true);
    },
  );

  it('館の外には出られない', () => {
    expect(reachable({ x: 0, z: 20 })).toBe(false);
    expect(reachable({ x: -20, z: 10 })).toBe(false);
    expect(reachable({ x: 0, z: -34 })).toBe(false);
  });
});
