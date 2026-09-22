/**
 * ミュラー・リヤー錯視の図形データ。座標は作品面の高さを 1 とした単位。
 * 上の線は外向きの矢羽（>—<）、下の線は内向きの矢羽（<—>）。2 本の線分（軸）は同じ長さ。
 */

export const MULLER_LYER_ASPECT = 1.6;

export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MullerLyerFigure {
  shaft: Segment;
  fins: Segment[];
}

export interface MullerLyerPattern {
  outward: MullerLyerFigure;
  inward: MullerLyerFigure;
}

export const SHAFT_LENGTH = 0.9;
export const FIN_LENGTH = 0.16;
/** 矢羽と軸のなす角（ラジアン） */
export const FIN_ANGLE = (36 * Math.PI) / 180;

function figure(cx: number, y: number, outward: boolean): MullerLyerFigure {
  const x0 = cx - SHAFT_LENGTH / 2;
  const x1 = cx + SHAFT_LENGTH / 2;
  const dx = Math.cos(FIN_ANGLE) * FIN_LENGTH;
  const dy = Math.sin(FIN_ANGLE) * FIN_LENGTH;
  // 外向き: 端から外側へ開く / 内向き: 端から内側へ戻る（矢じり）
  const sx = outward ? 1 : -1;
  const fins: Segment[] = [];
  for (const [x, dir] of [
    [x0, -1],
    [x1, 1],
  ] as const) {
    for (const sy of [-1, 1]) {
      fins.push({ x0: x, y0: y, x1: x + dir * sx * dx, y1: y + sy * dy });
    }
  }
  return { shaft: { x0, y0: y, x1, y1: y }, fins };
}

export function mullerLyerPattern(): MullerLyerPattern {
  const cx = MULLER_LYER_ASPECT / 2;
  return { outward: figure(cx, 0.32, true), inward: figure(cx, 0.7, false) };
}

export function segmentLength(s: Segment): number {
  return Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
}
