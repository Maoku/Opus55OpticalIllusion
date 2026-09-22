/**
 * エビングハウス錯視の図形データ。座標は作品面の高さを 1 とした単位（幅は ASPECT）。
 * 左右の中央の円は同じ半径で、左は大きな円、右は小さな円で囲む。
 */

export const EBBINGHAUS_ASPECT = 2;

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface EbbinghausGroup {
  center: Circle;
  surround: Circle[];
}

export interface EbbinghausPattern {
  left: EbbinghausGroup;
  right: EbbinghausGroup;
}

export const EBBINGHAUS_COLORS = {
  paper: '#f6f4ef',
  center: '#f08a24',
  surround: '#7489a3',
};

/** 中央の円の半径 */
export const CENTER_R = 0.07;

function ring(cx: number, cy: number, count: number, dist: number, r: number, phase = 0): Circle[] {
  return Array.from({ length: count }, (_, i) => {
    const a = phase + (i / count) * Math.PI * 2;
    return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, r };
  });
}

/**
 * separation: 0 で通常の配置、1 で中央の円どうしが中央に並んだ配置（デモの最終状態）
 */
export function ebbinghausPattern(separation = 0): EbbinghausPattern {
  const leftX = 0.52 + (EBBINGHAUS_ASPECT / 2 - 0.1 - 0.52) * separation;
  const rightX = 1.48 + (EBBINGHAUS_ASPECT / 2 + 0.1 - 1.48) * separation;
  return {
    left: {
      center: { x: leftX, y: 0.5, r: CENTER_R },
      surround: ring(0.52, 0.5, 6, 0.3, 0.14, Math.PI / 6),
    },
    right: {
      center: { x: rightX, y: 0.5, r: CENTER_R },
      surround: ring(1.48, 0.5, 8, 0.125, 0.034),
    },
  };
}
