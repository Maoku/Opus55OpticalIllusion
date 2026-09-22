/**
 * 床面（XZ 平面）での 2D 衝突判定。プレイヤーは半径 r の円、障害物は軸平行の矩形か円。
 * 押し出しを繰り返すことで、壁に沿ってスライドする動きになる。
 */

export interface RectCollider {
  kind: 'rect';
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

export type Collider = RectCollider | CircleCollider;

export interface Vec2 {
  x: number;
  z: number;
}

export function rectCollider(x0: number, z0: number, x1: number, z1: number): RectCollider {
  return {
    kind: 'rect',
    x0: Math.min(x0, x1),
    z0: Math.min(z0, z1),
    x1: Math.max(x0, x1),
    z1: Math.max(z0, z1),
  };
}

/** 1 サブステップで進める最大距離（半径に対する比）。これでトンネリングを防ぐ */
const SUBSTEP_RATIO = 0.4;
const PUSH_ITERATIONS = 4;

export class CollisionWorld {
  readonly colliders: Collider[] = [];

  add(...colliders: Collider[]): void {
    this.colliders.push(...colliders);
  }

  clear(): void {
    this.colliders.length = 0;
  }

  /** 位置 p から delta だけ動かしたあとの位置を返す（壁に沿ってスライドする） */
  move(p: Vec2, delta: Vec2, radius: number): Vec2 {
    const dist = Math.hypot(delta.x, delta.z);
    const steps = Math.max(1, Math.ceil(dist / (radius * SUBSTEP_RATIO)));
    let x = p.x;
    let z = p.z;
    for (let i = 0; i < steps; i++) {
      x += delta.x / steps;
      z += delta.z / steps;
      const r = this.resolve({ x, z }, radius);
      x = r.x;
      z = r.z;
    }
    return { x, z };
  }

  /** 円が障害物に食い込んでいれば押し出す */
  resolve(p: Vec2, radius: number): Vec2 {
    let x = p.x;
    let z = p.z;
    for (let iter = 0; iter < PUSH_ITERATIONS; iter++) {
      let moved = false;
      for (const c of this.colliders) {
        const push = penetration(c, x, z, radius);
        if (push) {
          x += push.x;
          z += push.z;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return { x, z };
  }

  /** 円が障害物に重なっているか */
  hits(p: Vec2, radius: number): boolean {
    return this.colliders.some((c) => penetration(c, p.x, p.z, radius) !== null);
  }
}

function penetration(c: Collider, x: number, z: number, r: number): Vec2 | null {
  if (c.kind === 'circle') {
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = r + c.r;
    if (d >= min) return null;
    if (d < 1e-9) return { x: min, z: 0 };
    const k = (min - d) / d;
    return { x: dx * k, z: dz * k };
  }

  const cx = Math.max(c.x0, Math.min(x, c.x1));
  const cz = Math.max(c.z0, Math.min(z, c.z1));
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;

  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const k = (r - d) / d;
    return { x: dx * k, z: dz * k };
  }

  // 中心が矩形の内側にある: いちばん近い辺から外へ出す
  const left = x - c.x0;
  const right = c.x1 - x;
  const top = z - c.z0;
  const bottom = c.z1 - z;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: -(left + r), z: 0 };
  if (m === right) return { x: right + r, z: 0 };
  if (m === top) return { x: 0, z: -(top + r) };
  return { x: 0, z: bottom + r };
}
