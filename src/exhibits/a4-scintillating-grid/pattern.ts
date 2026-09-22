/**
 * きらめき格子錯視の図形データ。座標は作品面の一辺を 1 とした単位（正方形）。
 * 黒地に灰色の格子線を引き、交点に白い円を置く。黒い点はどこにも描かない。
 */

export interface GridOptions {
  /** 格子線の本数（縦横それぞれ） */
  lines: number;
  /** 線の太さ（格子の間隔に対する割合） */
  lineWidth: number;
  /** 交点の円の直径（線の太さに対する倍率）。1.3〜1.6 倍で効果が強い */
  discScale: number;
  margin: number;
}

export const GRID_DEFAULTS: GridOptions = {
  lines: 11,
  lineWidth: 0.16,
  discScale: 1.5,
  margin: 0.06,
};

export const GRID_COLORS = {
  background: '#000000',
  line: '#7c7c7c',
  disc: '#ffffff',
};

export interface GridPattern {
  /** 線の中心位置（縦線の x、横線の y は同じ値） */
  positions: number[];
  lineWidth: number;
  discRadius: number;
  /** 交点（白い円の中心） */
  discs: { x: number; y: number }[];
  /** 格子の外枠 */
  extent: { min: number; max: number };
}

export function gridPattern(opts: Partial<GridOptions> = {}): GridPattern {
  const o = { ...GRID_DEFAULTS, ...opts };
  const span = 1 - o.margin * 2;
  const pitch = span / (o.lines - 1);
  const positions = Array.from({ length: o.lines }, (_, i) => o.margin + i * pitch);
  const lineWidth = pitch * o.lineWidth;
  const discRadius = (lineWidth * o.discScale) / 2;
  const discs = positions.flatMap((y) => positions.map((x) => ({ x, y })));
  return {
    positions,
    lineWidth,
    discRadius,
    discs,
    extent: { min: o.margin - lineWidth, max: 1 - o.margin + lineWidth },
  };
}
