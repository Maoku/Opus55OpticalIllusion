/**
 * 視点合わせの数学（計画書 §4.7）。「特定の位置 P から見たときだけ X に見える」作品で使う。
 * すべて純粋関数で、three.js に依存しない（単体テストしやすくするため）。
 */

export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: V3): number => Math.sqrt(dot(a, a));
export const normalize = (a: V3): V3 => scale(a, 1 / length(a));

/** 視点のカメラ基底（right, up, back）。back は視線と逆向き */
export interface ViewBasis {
  eye: V3;
  right: V3;
  up: V3;
  back: V3;
}

export function lookBasis(eye: V3, target: V3, worldUp: V3 = [0, 1, 0]): ViewBasis {
  const back = normalize(sub(eye, target));
  const right = normalize(cross(worldUp, back));
  const up = cross(back, right);
  return { eye, right, up, back };
}

/** P から見た像の座標（透視投影。視線方向の距離で割った値）と奥行き */
export function projectFrom(basis: ViewBasis, v: V3): { x: number; y: number; depth: number } {
  const d = sub(v, basis.eye);
  const depth = -dot(d, basis.back);
  return { x: dot(d, basis.right) / depth, y: dot(d, basis.up) / depth, depth };
}

/**
 * 光線上配置: 点 v を、P から見た方向を保ったまま P からの距離を k 倍の位置へ動かす。
 * 2D の断片を奥行きの違う位置に置くとき、d/d₀ 倍に拡大することに相当する。
 */
export function placeOnRay(eye: V3, v: V3, k: number): V3 {
  return add(eye, scale(sub(v, eye), k));
}

/**
 * 透視的共線変換（ホモロジー）: v' = P + (v − P) / (a·(v − P) + b)。
 * 各点は P を通る光線の上を動くので、P からの見た目は変わらない。射影変換なので平面は平面に写る。
 * 領域内で a·(v − P) + b > 0 を保つこと。
 */
export function homology(eye: V3, a: V3, b: number, v: V3): V3 {
  const d = sub(v, eye);
  const den = dot(a, d) + b;
  if (den <= 0) throw new Error('homology: 分母が 0 以下になる点があります');
  return add(eye, scale(d, 1 / den));
}

/**
 * 正射影で設計した形を、P からの透視で同じに見えるよう補正する。
 * 視線方向の距離 depth はそのままに、視線に垂直な成分を depth / d0 倍する。
 * P から見た像は「正射影の像 / d0」になる（例: ペンローズの三角形の端を重ねる）。
 */
export function orthoToPerspective(basis: ViewBasis, d0: number, v: V3): V3 {
  const d = sub(v, basis.eye);
  const depth = -dot(d, basis.back);
  const x = dot(d, basis.right);
  const y = dot(d, basis.up);
  const k = depth / d0;
  return add(
    basis.eye,
    add(add(scale(basis.right, x * k), scale(basis.up, y * k)), scale(basis.back, -depth)),
  );
}

/** 正射影の像（視線に垂直な成分） */
export function orthoImage(basis: ViewBasis, v: V3): { x: number; y: number } {
  const d = sub(v, basis.eye);
  return { x: dot(d, basis.right), y: dot(d, basis.up) };
}

/** 3 点が同じ平面にある 4 点目の、平面からの距離（平面性の検査用） */
export function planeDistance(p0: V3, p1: V3, p2: V3, q: V3): number {
  const n = normalize(cross(sub(p1, p0), sub(p2, p0)));
  return Math.abs(dot(n, sub(q, p0)));
}
