import { homology, type V3 } from '../common/viewpoint';

/**
 * エイムズの部屋の設計（展示ローカル座標、単位 m）。
 * 覗き穴から見た「見かけの部屋」は普通の直方体の模型（縮尺約 1/2.7）。
 * その全頂点を覗き穴 P を中心とするホモロジーで写し、左の奥ほど遠く、右ほど近くにする。
 */

/** 覗き穴（目の位置） */
export const PEEPHOLE: V3 = [0, 1.6, 0];

/** 見かけの部屋（直方体） */
export const APPARENT = {
  x0: -0.8,
  x1: 0.8,
  y0: 0.95,
  y1: 1.85,
  /** 手前（開口部）と奥の壁 */
  zFront: -0.5,
  zBack: -1.7,
};

/** ホモロジーの係数: v' = P + (v − P) / (a·(v − P) + b) */
export const HOMOLOGY_A: V3 = [0.55, 0, 0];
export const HOMOLOGY_B = 1;

/** 見かけの部屋の点を、実際の（歪んだ）部屋の点に写す */
export function toReal(v: V3): V3 {
  return homology(PEEPHOLE, HOMOLOGY_A, HOMOLOGY_B, v);
}

/** 人形の足元（見かけの部屋で、奥の左右の隅） */
export const DOLL_LEFT: V3 = [-0.68, APPARENT.y0, -1.47];
export const DOLL_RIGHT: V3 = [0.68, APPARENT.y0, -1.47];
export const DOLL_HEIGHT = 0.42;

/** 見かけの部屋の中で、奥の壁に沿って人形を動かす（t: 0 → 1 で左から右へ） */
export function dollPath(t: number): V3 {
  return [DOLL_LEFT[0] + (DOLL_RIGHT[0] - DOLL_LEFT[0]) * t, APPARENT.y0, DOLL_LEFT[2]];
}

/** 実際の部屋での、P からの距離の倍率（見かけの部屋に対して） */
export function depthFactor(v: V3): number {
  const d: V3 = [v[0] - PEEPHOLE[0], v[1] - PEEPHOLE[1], v[2] - PEEPHOLE[2]];
  return 1 / (HOMOLOGY_A[0] * d[0] + HOMOLOGY_A[1] * d[1] + HOMOLOGY_A[2] * d[2] + HOMOLOGY_B);
}

/** ブースの外形（ローカル座標）。歪んだ部屋をすべて囲む */
export const BOOTH = { x0: -1.6, x1: 0.95, z0: -3.25, z1: 0, height: 2.35 };
