/**
 * チェッカーシャドウ（立体版）の盤面の設計。単位は m、盤の中心が原点（u: 右、v: 手前）。
 *
 * 陰影はライティングで計算せず、線形空間で「タイルの色 × 影の係数」を計算して焼き込む。
 * 影の外の暗いタイル A と、影の中の明るいタイル B が、sRGB で完全に同じ値になるよう係数を決める。
 */

export const N = 5;
export const TILE = 0.2;
export const BOARD = N * TILE;

/** sRGB（0〜255）⇔ 線形 */
export function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(l: number): number {
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
}

/** A と B の画素値（sRGB）: #787878 */
export const TARGET_GRAY = 0x78;
/** 明るいタイル（影の外） */
export const LIGHT = 0xdc;
/** 影の係数（線形）: 明るいタイル × SHADOW = 暗いタイル */
export const SHADOW = srgbToLinear(TARGET_GRAY) / srgbToLinear(LIGHT);

/** 円柱（盤の座標） */
export const CYLINDER = { u: TILE, v: 0, radius: 0.085, height: 0.42 };

/** 光源の向き（右手前の上、展示ローカル座標 x, y, z） */
export const LIGHT_DIR = [0.75, 0.6, 0.3] as const;

/** 影の広がり: 円柱から光と逆の向き（左奥）へ伸びる、やわらかい縁のカプセル */
const SHADOW_DIR = (() => {
  const l = Math.hypot(LIGHT_DIR[0], LIGHT_DIR[2]);
  return [-LIGHT_DIR[0] / l, -LIGHT_DIR[2] / l] as const;
})();
const SHADOW_LENGTH = 3.2 * TILE;
const SHADOW_RADIUS = 0.9 * TILE;
const PENUMBRA = 0.45 * TILE;

export interface TileIndex {
  i: number;
  j: number;
}

/** 影の外の暗いタイル A と、影の中の明るいタイル B */
export const TILE_A: TileIndex = { i: 0, j: 3 };
export const TILE_B: TileIndex = { i: 1, j: 1 };

export function tileCenter({ i, j }: TileIndex): { u: number; v: number } {
  return { u: (i - (N - 1) / 2) * TILE, v: (j - (N - 1) / 2) * TILE };
}

export function isLightTile({ i, j }: TileIndex): boolean {
  return (i + j) % 2 === 0;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 盤上の点の明るさの係数（1: 日なた、SHADOW: 本影） */
export function shadeAt(u: number, v: number): number {
  const du = u - CYLINDER.u;
  const dv = v - CYLINDER.v;
  const along = Math.min(SHADOW_LENGTH, Math.max(0, du * SHADOW_DIR[0] + dv * SHADOW_DIR[1]));
  const px = CYLINDER.u + SHADOW_DIR[0] * along;
  const pv = CYLINDER.v + SHADOW_DIR[1] * along;
  const dist = Math.hypot(u - px, v - pv);
  const lit = smoothstep(SHADOW_RADIUS - PENUMBRA, SHADOW_RADIUS + PENUMBRA, dist);
  return SHADOW + (1 - SHADOW) * lit;
}

/** 盤上の点の画素値（sRGB 0〜255、灰色） */
export function boardValue(u: number, v: number): number {
  const i = Math.min(N - 1, Math.max(0, Math.floor(u / TILE + N / 2)));
  const j = Math.min(N - 1, Math.max(0, Math.floor(v / TILE + N / 2)));
  const base = isLightTile({ i, j }) ? LIGHT : TARGET_GRAY;
  return linearToSrgb(srgbToLinear(base) * shadeAt(u, v));
}
