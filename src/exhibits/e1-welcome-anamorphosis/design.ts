/**
 * E-1 ようこそ（アナモルフォーシス）の設計。展示は中央ホールの原点に置くので、ローカル座標 = 世界座標。
 *
 * 床マーク P に置いた仮想プロジェクタから館名ロゴを投影し、光が当たる場所（北の壁・垂れ壁・床・
 * 吊りパネル・柱）にだけ断片を描く。P から見ると、奥行きの違う断片が 1 枚の絵に戻る。
 */

export const EYE = { x: 0, y: 1.6, z: 5.2 };
/** プロジェクタの向き（北の壁の少し上） */
export const LOOK_AT = { x: 0, y: 2.75, z: -8 };
export const PROJECTOR_FOV = 34;
export const PROJECTOR_ASPECT = 1.74;
export const VIEW_FOV = 40;

/** ホール北の壁の面（z）。開口部（回廊 C）は x ∈ [-2, 2]、高さ 4 m まで */
export const WALL_Z = -8;
export const OPENING = { x0: -2, x1: 2, top: 4 };
export const HALL_HEIGHT = 8;

/** 吊りパネル（回廊の開口部の前に下がり、ロゴの中央を受け止める） */
export const PANEL = { z: -3, x0: -1.45, x1: 1.45, y0: 1.1, y1: 2.95 };
/** 柱（ロゴの左側を受け止める） */
export const COLUMN = { x: -3.2, z: -5.0, r: 0.35 };

type P3 = { x: number; y: number; z: number };

/** P から点 p への線分が、吊りパネルを横切るか */
export function hitsPanel(p: P3, eye: P3 = EYE): boolean {
  const t = (PANEL.z - eye.z) / (p.z - eye.z);
  if (!(t > 0 && t < 0.999)) return false;
  const x = eye.x + t * (p.x - eye.x);
  const y = eye.y + t * (p.y - eye.y);
  return x > PANEL.x0 && x < PANEL.x1 && y > PANEL.y0 && y < PANEL.y1;
}

/** P から点 p への線分が、柱に入るか（柱の表面より奥の点なら true） */
export function hitsColumn(p: P3, eye: P3 = EYE): boolean {
  const dx = p.x - eye.x;
  const dz = p.z - eye.z;
  const ox = eye.x - COLUMN.x;
  const oz = eye.z - COLUMN.z;
  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - COLUMN.r * COLUMN.r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t > 0 && t < 0.999;
}

/** 床に当たる光線の、床上の位置（P から見下ろす角 pitch 度の光線） */
export function floorHit(pitchDeg: number): number {
  return EYE.z - EYE.y / Math.tan((Math.abs(pitchDeg) * Math.PI) / 180);
}
