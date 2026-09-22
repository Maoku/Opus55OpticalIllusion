/**
 * 美術館の間取りの宣言的データ（§5.2）と、そこから壁・天井を導く純粋関数。
 *
 * 座標系: 1 ユニット = 1m、Y が上、北が -Z。
 * 部屋は軸平行の矩形で、辺どうしが接している部分が開口部（通り抜けられる）になる。
 * 高さが違う部屋が接する開口部の上には、高いほうの部屋の垂れ壁（まぐさ）をつくる。
 */

import type { ExhibitId } from '../content/types';

export type ZoneId = 'entrance' | 'hall' | 'zoneA' | 'zoneB' | 'zoneC' | 'corridor';

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export type Side = 'north' | 'south' | 'west' | 'east';

export interface RoomDef {
  id: string;
  zone: ZoneId;
  rect: Rect;
  /** 天井高（m） */
  height: number;
  /** 天窓（天井の穴）の矩形 */
  skylights?: Rect[];
  /** ガラス張りにする辺 */
  glassSides?: Side[];
  /** 暗室。天窓や建築の照明の影響を抑えた濃い色で仕上げる */
  dark?: boolean;
}

export interface FurnitureDef {
  kind: 'bench' | 'counter';
  x: number;
  z: number;
  /** Y 軸回転（ラジアン） */
  rotation: number;
}

export interface SignDef {
  /** 壁面上の中心位置 */
  x: number;
  y: number;
  z: number;
  rotation: number;
  title: string;
  subtitle: string;
  width: number;
}

export interface ZoneInfo {
  id: ZoneId;
  name: string;
  nameEn: string;
}

export const ZONES: Record<ZoneId, ZoneInfo> = {
  entrance: { id: 'entrance', name: 'エントランス', nameEn: 'Entrance' },
  hall: { id: 'hall', name: '中央ホール', nameEn: 'Central Hall' },
  zoneA: { id: 'zoneA', name: 'Zone A 平面錯視ギャラリー', nameEn: 'Plane Gallery' },
  zoneB: { id: 'zoneB', name: 'Zone B 立体錯視ホール', nameEn: 'Spatial Hall' },
  zoneC: { id: 'zoneC', name: 'Zone C オリジナル展示室', nameEn: 'Original Room' },
  corridor: { id: 'corridor', name: '回廊', nameEn: 'Corridor' },
};

export const WALL_THICKNESS = 0.3;
export const CEILING_THICKNESS = 0.3;
export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.3;

export const ROOMS: RoomDef[] = [
  {
    id: 'entrance',
    zone: 'entrance',
    rect: { x0: -4, z0: 8, x1: 4, z1: 14 },
    height: 4.5,
    glassSides: ['south'],
  },
  {
    id: 'hall',
    zone: 'hall',
    rect: { x0: -10, z0: -8, x1: 10, z1: 8 },
    height: 8,
    skylights: [{ x0: -5, z0: -4, x1: 5, z1: 4 }],
  },
  { id: 'corridor-a', zone: 'corridor', rect: { x0: -14, z0: -2, x1: -10, z1: 2 }, height: 4 },
  {
    id: 'zone-a',
    zone: 'zoneA',
    rect: { x0: -44, z0: -6, x1: -14, z1: 6 },
    height: 4.5,
    skylights: [{ x0: -41, z0: -0.8, x1: -17, z1: 0.8 }],
  },
  { id: 'corridor-b', zone: 'corridor', rect: { x0: 10, z0: -2, x1: 14, z1: 2 }, height: 4 },
  {
    id: 'zone-b',
    zone: 'zoneB',
    rect: { x0: 14, z0: -12, x1: 38, z1: 12 },
    height: 6,
    skylights: [{ x0: 24, z0: -3, x1: 34, z1: 3 }],
  },
  { id: 'corridor-c', zone: 'corridor', rect: { x0: -2, z0: -14, x1: 2, z1: -8 }, height: 4 },
  {
    id: 'zone-c',
    zone: 'zoneC',
    rect: { x0: -10, z0: -28, x1: 3, z1: -14 },
    height: 5,
    glassSides: ['north'],
  },
  { id: 'zone-c-south', zone: 'zoneC', rect: { x0: 3, z0: -21, x1: 10, z1: -14 }, height: 5 },
  // C-2 の暗室と、そこへ入る扉（壁の厚みぶんの小さな部屋として表す）
  {
    id: 'darkroom-door',
    zone: 'zoneC',
    rect: { x0: 3, z0: -25.2, x1: 3.3, z1: -23.8 },
    height: 2.4,
  },
  {
    id: 'darkroom',
    zone: 'zoneC',
    rect: { x0: 3.3, z0: -28, x1: 10, z1: -21.3 },
    height: 3.2,
    dark: true,
  },
];

export const FURNITURE: FurnitureDef[] = [
  { kind: 'counter', x: 6.5, z: 5, rotation: -Math.PI / 2 },
  { kind: 'bench', x: -33, z: 0, rotation: 0 },
  { kind: 'bench', x: -25, z: 0, rotation: 0 },
  { kind: 'bench', x: 34, z: 9.5, rotation: 0 },
  { kind: 'bench', x: -6, z: -26.2, rotation: 0 },
];

export const SIGNS: SignDef[] = [
  {
    x: -43.98,
    y: 2.6,
    z: 0,
    rotation: Math.PI / 2,
    title: 'A  平面錯視ギャラリー',
    subtitle: 'PLANE GALLERY',
    width: 5,
  },
  {
    x: 37.98,
    y: 3.6,
    z: 0,
    rotation: -Math.PI / 2,
    title: 'B  立体錯視ホール',
    subtitle: 'SPATIAL HALL',
    width: 5,
  },
  {
    x: -9.98,
    y: 3.2,
    z: -21,
    rotation: Math.PI / 2,
    title: 'C  オリジナル展示室',
    subtitle: 'ORIGINAL ROOM',
    width: 5,
  },
  {
    x: 0,
    y: 6.2,
    z: -7.98,
    rotation: 0,
    title: 'OPTICAL ILLUSION MUSEUM',
    subtitle: '錯視美術館',
    width: 9,
  },
];

export interface ExhibitPlacement {
  id: ExhibitId;
  /** 展示のローカル原点（床面） */
  x: number;
  z: number;
  /** 展示の正面（ローカル +Z）の向き。0 = 南（+Z）、π = 北、π/2 = 東、-π/2 = 西 */
  rotation: number;
}

const N = Math.PI;
const W = -Math.PI / 2;

/** 展示の配置。並び順が推奨の順路（前後の作品）になる */
export const EXHIBIT_PLACEMENTS: ExhibitPlacement[] = [
  { id: 'welcome-anamorphosis', x: 0, z: 0, rotation: 0 },
  // Zone A: 北の壁を東から西へ、南の壁を西から東へ一周する
  { id: 'cafe-wall', x: -20, z: -6, rotation: 0 },
  { id: 'ebbinghaus', x: -29, z: -6, rotation: 0 },
  { id: 'muller-lyer', x: -38, z: -6, rotation: 0 },
  { id: 'scintillating-grid', x: -38, z: 6, rotation: N },
  { id: 'peripheral-drift', x: -29, z: 6, rotation: N },
  { id: 'afterimage', x: -20, z: 6, rotation: N },
  // Zone B
  { id: 'ames-room', x: 20, z: -8, rotation: 0 },
  { id: 'impossible-triangle', x: 30.5, z: -8, rotation: 0 },
  { id: 'checker-shadow', x: 27, z: 6.5, rotation: N },
  { id: 'reverspective', x: 20, z: 12, rotation: N },
  { id: 'shadow-spinner', x: 38, z: -6, rotation: W },
  // Zone C
  { id: 'circle-heart', x: -5, z: -22, rotation: 0 },
  { id: 'colorless-fruit', x: 7.6, z: -24.6, rotation: W },
  { id: 'invisible-triangle', x: 10, z: -17.5, rotation: W },
];

/** 入館直後の位置と向き（yaw = 0 で北 = -Z を向く） */
export const SPAWN = { x: 0, z: 12.6, yaw: 0 };

// ---------------------------------------------------------------------------
// 純粋関数
// ---------------------------------------------------------------------------

const EPS = 1e-6;

export interface Interval {
  a: number;
  b: number;
}

export interface OpeningInfo extends Interval {
  /** 開口部の高さ（接する 2 部屋の低いほうの天井高） */
  height: number;
  otherRoomId: string;
}

export interface SideInfo {
  side: Side;
  /** 辺の位置（west/east なら x、north/south なら z） */
  at: number;
  /** 辺の範囲（west/east なら z、north/south なら x） */
  range: Interval;
  /** 部屋の外側へ向かう符号（+1 / -1） */
  outward: 1 | -1;
  axis: 'x' | 'z';
}

export function sidesOf(room: RoomDef): SideInfo[] {
  const r = room.rect;
  return [
    { side: 'north', at: r.z0, range: { a: r.x0, b: r.x1 }, outward: -1, axis: 'z' },
    { side: 'south', at: r.z1, range: { a: r.x0, b: r.x1 }, outward: 1, axis: 'z' },
    { side: 'west', at: r.x0, range: { a: r.z0, b: r.z1 }, outward: -1, axis: 'x' },
    { side: 'east', at: r.x1, range: { a: r.z0, b: r.z1 }, outward: 1, axis: 'x' },
  ];
}

/** 部屋の 1 辺に接している他の部屋との開口部 */
export function openingsOf(room: RoomDef, side: SideInfo, rooms: RoomDef[]): OpeningInfo[] {
  const result: OpeningInfo[] = [];
  for (const other of rooms) {
    if (other.id === room.id) continue;
    for (const os of sidesOf(other)) {
      if (os.axis !== side.axis || os.outward === side.outward) continue;
      if (Math.abs(os.at - side.at) > EPS) continue;
      const a = Math.max(side.range.a, os.range.a);
      const b = Math.min(side.range.b, os.range.b);
      if (b - a > EPS) {
        result.push({ a, b, height: Math.min(room.height, other.height), otherRoomId: other.id });
      }
    }
  }
  return result.sort((p, q) => p.a - q.a);
}

/** 区間 range から holes を取り除いた残り */
export function subtractIntervals(range: Interval, holes: Interval[]): Interval[] {
  const sorted = [...holes].sort((p, q) => p.a - q.a);
  const out: Interval[] = [];
  let cursor = range.a;
  for (const h of sorted) {
    if (h.b <= cursor + EPS) continue;
    if (h.a > cursor + EPS) out.push({ a: cursor, b: Math.min(h.a, range.b) });
    cursor = Math.max(cursor, h.b);
    if (cursor >= range.b - EPS) break;
  }
  if (cursor < range.b - EPS) out.push({ a: cursor, b: range.b });
  return out.filter((iv) => iv.b - iv.a > EPS);
}

export interface WallPiece {
  roomId: string;
  side: Side;
  kind: 'wall' | 'lintel' | 'glass' | 'corner';
  /** 床面での外形（厚みを含む） */
  rect: Rect;
  y0: number;
  y1: number;
}

function footprint(side: SideInfo, iv: Interval, t: number): Rect {
  const c0 = side.at;
  const c1 = side.at + side.outward * t;
  return side.axis === 'x'
    ? { x0: Math.min(c0, c1), x1: Math.max(c0, c1), z0: iv.a, z1: iv.b }
    : { x0: iv.a, x1: iv.b, z0: Math.min(c0, c1), z1: Math.max(c0, c1) };
}

/** 全部屋の壁・垂れ壁・ガラス・出隅の柱を求める */
export function computeWalls(rooms: RoomDef[], t = WALL_THICKNESS): WallPiece[] {
  const pieces: WallPiece[] = [];
  for (const room of rooms) {
    const top = room.height + CEILING_THICKNESS;
    const sides = sidesOf(room);
    const solidAtCorner = new Map<string, boolean>();

    for (const side of sides) {
      const openings = openingsOf(room, side, rooms);
      const solid = subtractIntervals(side.range, openings);
      const kind = room.glassSides?.includes(side.side) ? 'glass' : 'wall';
      for (const iv of solid) {
        pieces.push({
          roomId: room.id,
          side: side.side,
          kind,
          rect: footprint(side, iv, t),
          y0: 0,
          y1: top,
        });
      }
      for (const op of openings) {
        if (room.height > op.height + EPS) {
          pieces.push({
            roomId: room.id,
            side: side.side,
            kind: 'lintel',
            rect: footprint(side, op, t),
            y0: op.height,
            y1: top,
          });
        }
      }
      const startSolid = solid.some((iv) => Math.abs(iv.a - side.range.a) < EPS);
      const endSolid = solid.some((iv) => Math.abs(iv.b - side.range.b) < EPS);
      solidAtCorner.set(`${side.side}:a`, startSolid);
      solidAtCorner.set(`${side.side}:b`, endSolid);
    }

    // 出隅（部屋の四隅の外側）を柱で埋める。隣り合う 2 辺の両方に壁があるときだけ
    const r = room.rect;
    const corners: [string, string, number, number, number, number][] = [
      ['north:a', 'west:a', r.x0 - t, r.z0 - t, r.x0, r.z0],
      ['north:b', 'east:a', r.x1, r.z0 - t, r.x1 + t, r.z0],
      ['south:a', 'west:b', r.x0 - t, r.z1, r.x0, r.z1 + t],
      ['south:b', 'east:b', r.x1, r.z1, r.x1 + t, r.z1 + t],
    ];
    for (const [k1, k2, x0, z0, x1, z1] of corners) {
      if (solidAtCorner.get(k1) && solidAtCorner.get(k2)) {
        pieces.push({
          roomId: room.id,
          side: k1.startsWith('north') ? 'north' : 'south',
          kind: 'corner',
          rect: { x0, z0, x1, z1 },
          y0: 0,
          y1: top,
        });
      }
    }
  }
  return pieces;
}

/** 矩形 r から holes を取り除いた残りを、格子に分けた矩形の集まりで返す */
export function subtractRects(r: Rect, holes: Rect[]): Rect[] {
  const xs = new Set([r.x0, r.x1]);
  const zs = new Set([r.z0, r.z1]);
  for (const h of holes) {
    for (const x of [h.x0, h.x1]) if (x > r.x0 && x < r.x1) xs.add(x);
    for (const z of [h.z0, h.z1]) if (z > r.z0 && z < r.z1) zs.add(z);
  }
  const X = [...xs].sort((a, b) => a - b);
  const Z = [...zs].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let i = 0; i < X.length - 1; i++) {
    for (let j = 0; j < Z.length - 1; j++) {
      const cell = { x0: X[i]!, x1: X[i + 1]!, z0: Z[j]!, z1: Z[j + 1]! };
      const cx = (cell.x0 + cell.x1) / 2;
      const cz = (cell.z0 + cell.z1) / 2;
      const inHole = holes.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
      if (!inHole) out.push(cell);
    }
  }
  return out;
}

export function roomAt(x: number, z: number, rooms: RoomDef[] = ROOMS): RoomDef | undefined {
  return rooms.find(
    (room) =>
      x >= room.rect.x0 - EPS &&
      x <= room.rect.x1 + EPS &&
      z >= room.rect.z0 - EPS &&
      z <= room.rect.z1 + EPS,
  );
}

/** 館全体の外接矩形 */
export function bounds(rooms: RoomDef[] = ROOMS): Rect {
  return {
    x0: Math.min(...rooms.map((r) => r.rect.x0)),
    z0: Math.min(...rooms.map((r) => r.rect.z0)),
    x1: Math.max(...rooms.map((r) => r.rect.x1)),
    z1: Math.max(...rooms.map((r) => r.rect.z1)),
  };
}
