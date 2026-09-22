import {
  add,
  dot,
  lookBasis,
  normalize,
  orthoToPerspective,
  scale,
  sub,
  type V3,
  type ViewBasis,
} from '../common/viewpoint';

/**
 * ペンローズの三角形の設計（展示ローカル座標、単位 m）。
 *
 * 彫刻座標 S で、角 A から x・y・z 方向へ長さ L の角材を順につなぐ（A → B → C → E）。
 * E = A + L(1,1,1) なので、(1,1,1) 方向から正射影で見ると E と A が重なり、閉じた三角形に見える。
 * S の (1,1,1) 方向を視点 P へ向け、正射影 → 透視の補正（viewpoint.orthoToPerspective）をかけると、
 * P からの透視でも端が正確に重なる。
 */

export const EYE: V3 = [0, 1.6, 4.4];
export const TARGET: V3 = [0, 1.55, 0];
export const FOV = 22;
export const L = 0.8;
export const W = 0.14;

const S_RIGHT = normalize([2, -1, -1]);
const S_UP = normalize([0, 1, -1]);
const S_BACK = normalize([1, 1, 1]);
/** 像の重心を通り、奥行きの中央にある点 */
const S_CENTER: V3 = [(11 * L) / 18, (11 * L) / 18, (5 * L) / 18];

export const BASIS: ViewBasis = lookBasis(EYE, TARGET);
export const D0 = Math.hypot(EYE[0] - TARGET[0], EYE[1] - TARGET[1], EYE[2] - TARGET[2]);

/** 彫刻座標 → 展示ローカル座標（正射影のまま、向きだけ合わせる） */
export function placeOrtho(s: V3): V3 {
  const d = sub(s, S_CENTER);
  return add(
    TARGET,
    add(
      add(scale(BASIS.right, dot(d, S_RIGHT)), scale(BASIS.up, dot(d, S_UP))),
      scale(BASIS.back, dot(d, S_BACK)),
    ),
  );
}

/** 彫刻座標 → 展示ローカル座標（P からの透視で正射影と同じ像になるよう補正） */
export function toLocal(s: V3): V3 {
  return orthoToPerspective(BASIS, D0, placeOrtho(s));
}

export interface Beam {
  min: V3;
  max: V3;
  /** 長手方向の軸 */
  axis: 0 | 1 | 2;
}

/** 3 本の角材（彫刻座標の直方体） */
export function beams(): Beam[] {
  const h = W / 2;
  return [
    { min: [-h, -h, -h], max: [L + h, h, h], axis: 0 },
    { min: [L - h, h, -h], max: [L + h, L + h, h], axis: 1 },
    { min: [L - h, L - h, h], max: [L + h, L + h, L + h], axis: 2 },
  ];
}

/** 重なって見える 2 つの角の中心（彫刻座標） */
export const CORNER_A: V3 = [0, 0, 0];
export const CORNER_E: V3 = [L, L, L];
