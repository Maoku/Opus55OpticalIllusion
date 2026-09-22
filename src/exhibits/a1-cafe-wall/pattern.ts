/**
 * カフェウォール錯視の図形データ（単位はタイル 1 枚の幅）。
 * 白黒のタイルの行を、1 行おきにタイル幅の shift 倍だけ横にずらし、行のあいだに灰色の目地を通す。
 */

export interface CafeWallOptions {
  cols: number;
  rows: number;
  /** 1 行おきのずれ（タイル幅に対する割合）。0.5 で「半分ずつずらした」配置 */
  shift: number;
  /** 目地の太さ（タイル幅に対する割合） */
  mortar: number;
  /** 周囲の余白（タイル幅に対する割合） */
  margin: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CafeWallPattern {
  width: number;
  height: number;
  /** 黒いタイル（白地に描く） */
  blackTiles: Box[];
  /** タイルを敷く領域（白地） */
  field: Box;
  /** 灰色の目地（行と行のあいだ） */
  mortarLines: Box[];
  /** 各行のずれ（タイル幅単位） */
  rowShifts: number[];
}

export const CAFE_WALL_DEFAULTS: CafeWallOptions = {
  cols: 12,
  rows: 9,
  shift: 0.5,
  mortar: 0.075,
  margin: 0.55,
};

export const CAFE_WALL_COLORS = {
  black: '#101010',
  white: '#ffffff',
  /** 目地は白と黒の中間の明るさのとき、傾きがもっとも強く見える */
  mortar: '#808080',
  paper: '#f7f6f2',
};

export function cafeWallPattern(opts: Partial<CafeWallOptions> = {}): CafeWallPattern {
  const o = { ...CAFE_WALL_DEFAULTS, ...opts };
  const fieldW = o.cols;
  const fieldH = o.rows + (o.rows - 1) * o.mortar;
  const width = fieldW + o.margin * 2;
  const height = fieldH + o.margin * 2;
  const left = o.margin;
  const right = o.margin + fieldW;

  const blackTiles: Box[] = [];
  const mortarLines: Box[] = [];
  const rowShifts: number[] = [];

  for (let r = 0; r < o.rows; r++) {
    const y = o.margin + r * (1 + o.mortar);
    const shift = (r % 2) * o.shift;
    rowShifts.push(shift);
    // ずらした分だけ左に 1 枚多く敷き、領域の端で切り落とす
    for (let k = -2; k <= o.cols + 1; k++) {
      if (((k % 2) + 2) % 2 !== 0) continue;
      const x0 = Math.max(left, left + k + shift);
      const x1 = Math.min(right, left + k + shift + 1);
      if (x1 - x0 > 1e-9) blackTiles.push({ x: x0, y, w: x1 - x0, h: 1 });
    }
    if (r < o.rows - 1) mortarLines.push({ x: left, y: y + 1, w: fieldW, h: o.mortar });
  }

  return {
    width,
    height,
    blackTiles,
    field: { x: left, y: o.margin, w: fieldW, h: fieldH },
    mortarLines,
    rowShifts,
  };
}
