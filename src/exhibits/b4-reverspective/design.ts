/**
 * 逆遠近（リバースペクティブ）の設計。展示ローカル座標（壁面が z = 0、手前が +z）。
 *
 * 壁から手前へ突き出した角錐台（凸）を 2 つ並べ、推奨視点 P0 から見た「奥へ続く街路」の絵を、
 * P0 に置いたプロジェクタから投影して描く。いちばん手前の面が街路の最も遠い部分（消失点側）になる。
 */

export const EYE = { x: 0, y: 1.6, z: 3.2 };
export const LOOK_AT = { x: 0, y: 1.6, z: 0 };
export const FOV = 50;
export const ALLOW_SHIFT = 1.5;

/** 背板（壁に取り付けたパネル） */
export const PLAQUE = { width: 3.4, height: 2.0, centerY: 1.62, depth: 0.03 };

/** 角錐台: 背面（壁側）と前面（手前）は相似な長方形（投影すると消失点を中心に相似に並ぶ） */
export interface Frustum {
  cx: number;
  cy: number;
  back: { w: number; h: number };
  front: { w: number; h: number };
  /** 背面から前面までの突き出し */
  depth: number;
}

const BACK = { w: 1.1, h: 1.3 };
const FRONT_SCALE = 0.35;

export const FRUSTUMS: Frustum[] = [-0.78, 0.78].map((cx) => ({
  cx,
  cy: 1.62,
  back: BACK,
  front: { w: BACK.w * FRONT_SCALE, h: BACK.h * FRONT_SCALE },
  depth: 0.42,
}));

export type P3 = { x: number; y: number; z: number };

/** 角錐台の 8 頂点（背面 TL, TR, BR, BL と 前面 TL, TR, BR, BL） */
export function frustumCorners(f: Frustum): { back: P3[]; front: P3[] } {
  const z0 = PLAQUE.depth;
  const z1 = PLAQUE.depth + f.depth;
  const rect = (w: number, h: number, z: number): P3[] => [
    { x: f.cx - w / 2, y: f.cy + h / 2, z },
    { x: f.cx + w / 2, y: f.cy + h / 2, z },
    { x: f.cx + w / 2, y: f.cy - h / 2, z },
    { x: f.cx - w / 2, y: f.cy - h / 2, z },
  ];
  return { back: rect(f.back.w, f.back.h, z0), front: rect(f.front.w, f.front.h, z1) };
}

export type P2 = { x: number; y: number };

/** 2 直線（a1-a2, b1-b2）の交点 */
export function intersect(a1: P2, a2: P2, b1: P2, b2: P2): P2 {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / d;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}

/**
 * 像の上で、背面の輪郭 qb と前面の輪郭 qf を結ぶ相似の中心（消失点）と、前面の縮尺。
 * 仮想の街路の奥行き t（0: 手前、1: 最も奥）での縮尺は λ(t) = 1 / (1 + t (1/λf − 1))。
 */
export function streetFrame(qb: P2[], qf: P2[]) {
  const vp = intersect(qb[0]!, qf[0]!, qb[2]!, qf[2]!);
  const lf =
    Math.hypot(qf[0]!.x - vp.x, qf[0]!.y - vp.y) / Math.hypot(qb[0]!.x - vp.x, qb[0]!.y - vp.y);
  const lambda = (t: number) => 1 / (1 + t * (1 / lf - 1));
  /** 背面の輪郭上の点 near を、奥行き t の位置へ写す */
  const at = (near: P2, t: number): P2 => {
    const k = lambda(t);
    return { x: vp.x + (near.x - vp.x) * k, y: vp.y + (near.y - vp.y) * k };
  };
  return { vp, lf, lambda, at };
}
