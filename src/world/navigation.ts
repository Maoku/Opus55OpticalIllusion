import type { CollisionWorld, Vec2 } from './collision';
import type { Rect } from './layout';

/**
 * 床を格子に分け、半径 radius の円が通れるマスを start から幅優先探索でたどる。
 * 戻り値の関数で、任意の地点に到達できるかを調べられる。
 */
export function floodReachable(
  world: CollisionWorld,
  area: Rect,
  start: Vec2,
  radius: number,
  cell = 0.25,
): (p: Vec2) => boolean {
  const nx = Math.ceil((area.x1 - area.x0) / cell) + 1;
  const nz = Math.ceil((area.z1 - area.z0) / cell) + 1;
  const visited = new Uint8Array(nx * nz);
  const idx = (i: number, j: number) => j * nx + i;
  const toCell = (p: Vec2) => ({
    i: Math.round((p.x - area.x0) / cell),
    j: Math.round((p.z - area.z0) / cell),
  });
  const free = (i: number, j: number) =>
    !world.hits({ x: area.x0 + i * cell, z: area.z0 + j * cell }, radius);

  const s = toCell(start);
  const queue: number[] = [];
  if (s.i >= 0 && s.i < nx && s.j >= 0 && s.j < nz && free(s.i, s.j)) {
    visited[idx(s.i, s.j)] = 1;
    queue.push(idx(s.i, s.j));
  }
  for (let head = 0; head < queue.length; head++) {
    const k = queue[head]!;
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || a >= nx || b < 0 || b >= nz) continue;
      const kk = idx(a, b);
      if (visited[kk] || !free(a, b)) continue;
      visited[kk] = 1;
      queue.push(kk);
    }
  }

  return (p: Vec2) => {
    const c = toCell(p);
    // 格子の丸めで壁際の点が外れないよう、周囲 1 マスも見る
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const a = c.i + di;
        const b = c.j + dj;
        if (a < 0 || a >= nx || b < 0 || b >= nz) continue;
        if (visited[idx(a, b)]) return true;
      }
    }
    return false;
  };
}
