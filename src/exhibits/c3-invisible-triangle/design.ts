import { add, lookBasis, scale, type V3, type ViewBasis } from '../common/viewpoint';

/**
 * 見えない三角形の設計（展示ローカル座標。白い壁が z = 0、視点は +z 側）。
 *
 * P から距離 D0 の「像の平面」でカニッツァの三角形（欠けた円盤 3 枚と、逆向きの三角形の角の V 字 3 つ）を描き、
 * 各パーツを光線上配置で別々の奥行き（D0 の k 倍）へ動かす。P から見た形は変わらない。
 */

export const EYE: V3 = [0, 1.6, 4.2];
export const CENTER: V3 = [0, 1.8, 0];
export const D0 = 2.4;
export const BASIS: ViewBasis = lookBasis(EYE, CENTER);

/** 像の平面での寸法（m） */
export const SIDE = 0.75;
export const PAC_R = 0.12;
export const OUTLINE_R = 0.36;
export const ARM = 0.15;
export const LINE_W = 0.022;

export type P2 = [number, number];

export interface Piece {
  kind: 'pacman' | 'vee';
  /** 像の平面での輪郭（1 つ以上の多角形） */
  polygons: P2[][];
  /** 奥行きの倍率（P からの距離 = D0 × k） */
  k: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

function pacman(cx: number, cy: number, toward: number): P2[] {
  // toward の向きに 60° の切れ込みを入れた円盤
  const pts: P2[] = [[cx, cy]];
  const start = toward + deg(30);
  const end = toward + deg(360 - 30);
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = start + ((end - start) * i) / n;
    pts.push([cx + Math.cos(a) * PAC_R, cy + Math.sin(a) * PAC_R]);
  }
  return pts;
}

/** 頂点 (vx, vy) から向き a へ伸びる腕（太さ LINE_W の長方形。角が欠けないよう少し手前から） */
function armRect(vx: number, vy: number, a: number): P2[] {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const h = LINE_W / 2;
  const nx = -dy * h;
  const ny = dx * h;
  const x0 = vx - dx * h;
  const y0 = vy - dy * h;
  const x1 = vx + dx * ARM;
  const y1 = vy + dy * ARM;
  return [
    [x0 - nx, y0 - ny],
    [x1 - nx, y1 - ny],
    [x1 + nx, y1 + ny],
    [x0 + nx, y0 + ny],
  ];
}

export function pieces(): Piece[] {
  const rt = SIDE / Math.sqrt(3);
  const pk = [0.55, 1.35, 0.9];
  const vk = [1.15, 0.7, 1.45];
  const out: Piece[] = [];
  [90, 210, 330].forEach((d, i) => {
    const x = Math.cos(deg(d)) * rt;
    const y = Math.sin(deg(d)) * rt;
    out.push({ kind: 'pacman', polygons: [pacman(x, y, deg(d + 180))], k: pk[i]! });
  });
  // 逆向きの三角形の頂点（下・右上・左上）と、隣の頂点へ向かう辺の向き
  [270, 30, 150].forEach((d, i) => {
    const x = Math.cos(deg(d)) * OUTLINE_R;
    const y = Math.sin(deg(d)) * OUTLINE_R;
    const a1 = deg(d + 180 - 30);
    const a2 = deg(d + 180 + 30);
    out.push({ kind: 'vee', polygons: [armRect(x, y, a1), armRect(x, y, a2)], k: vk[i]! });
  });
  return out;
}

/** 像の平面の点 (u, w) を、奥行きの倍率 k の位置の 3D 点へ（光線上配置） */
export function toLocal(p: P2, k: number): V3 {
  const onPlane = add(add(scale(BASIS.back, -D0), scale(BASIS.right, p[0])), scale(BASIS.up, p[1]));
  return add(EYE, scale(onPlane, k));
}
