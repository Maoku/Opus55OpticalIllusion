/**
 * 周辺ドリフト錯視の図形データ（独自の図柄）。座標は作品面の高さを 1 とした単位。
 *
 * 円盤を 3 × 2 に並べ、各円盤を同心の輪に分ける。輪は小さな区画の繰り返しで、
 * 1 区画を角度方向に「黒 → 濃い色 → 白 → 淡い色」の 4 つの帯に分ける。
 * この明るさの並びの向きに回って見える。隣り合う輪と円盤で向きを交互に反転させる。
 */

export const DRIFT_ASPECT = 1.5;

/** 輝度の段階（0: 黒, 1: 濃い色, 2: 白, 3: 淡い色） */
export type Step = 0 | 1 | 2 | 3;

/** 回って見える並び（角度が増える向きに 黒 → 濃 → 白 → 淡） */
export const DRIFT_SEQUENCE: readonly Step[] = [0, 1, 2, 3];
/** 左右対称な並び（デモ用）。向きの手がかりがないので回って見えない */
export const STATIC_SEQUENCE: readonly Step[] = [0, 1, 2, 1];

/** 各帯の角度の幅（区画に対する割合）。黒と白を細く、中間色を太くする */
export const BAND_WIDTHS = [0.16, 0.34, 0.16, 0.34] as const;

export interface Wedge {
  cx: number;
  cy: number;
  r0: number;
  r1: number;
  a0: number;
  a1: number;
  step: Step;
  /** 輪の向き（+1: 角度が増える向きに並ぶ） */
  dir: 1 | -1;
}

export interface DriftDisc {
  cx: number;
  cy: number;
  radius: number;
  /** +1: 角度が増える向き、-1: 逆向き（外側の輪） */
  direction: 1 | -1;
}

export interface DriftOptions {
  cols: number;
  rows: number;
  rings: number;
  /** 最も外側の輪の区画数 */
  segments: number;
  sequence: readonly Step[];
}

export const DRIFT_DEFAULTS: DriftOptions = {
  cols: 3,
  rows: 2,
  rings: 4,
  segments: 24,
  sequence: DRIFT_SEQUENCE,
};

export function driftDiscs(opts: Partial<DriftOptions> = {}): DriftDisc[] {
  const o = { ...DRIFT_DEFAULTS, ...opts };
  const cellW = DRIFT_ASPECT / o.cols;
  const cellH = 1 / o.rows;
  const radius = Math.min(cellW, cellH) * 0.46;
  const discs: DriftDisc[] = [];
  for (let j = 0; j < o.rows; j++) {
    for (let i = 0; i < o.cols; i++) {
      discs.push({
        cx: cellW * (i + 0.5),
        cy: cellH * (j + 0.5),
        radius,
        direction: (i + j) % 2 === 0 ? 1 : -1,
      });
    }
  }
  return discs;
}

export function driftWedges(opts: Partial<DriftOptions> = {}): Wedge[] {
  const o = { ...DRIFT_DEFAULTS, ...opts };
  const wedges: Wedge[] = [];
  for (const disc of driftDiscs(o)) {
    const inner = disc.radius * 0.18;
    const ringW = (disc.radius - inner) / o.rings;
    for (let k = 0; k < o.rings; k++) {
      const r0 = inner + k * ringW;
      const r1 = r0 + ringW * 0.94;
      // 内側の輪ほど区画を少なくし、区画の形をそろえる
      const n = Math.max(8, Math.round((o.segments * (r0 + r1)) / 2 / disc.radius / 2) * 2);
      const dir = (k % 2 === 0 ? disc.direction : -disc.direction) as 1 | -1;
      const seg = (Math.PI * 2) / n;
      const phase = k * 0.37;
      for (let s = 0; s < n; s++) {
        let a = phase + s * seg;
        for (let b = 0; b < 4; b++) {
          const width = BAND_WIDTHS[b]! * seg;
          const step = o.sequence[b]!;
          // dir = -1 のときは角度が減る向きに並べる
          const a0 = dir === 1 ? a : a - width;
          const a1 = dir === 1 ? a + width : a;
          wedges.push({ cx: disc.cx, cy: disc.cy, r0, r1, a0, a1, step, dir });
          a = dir === 1 ? a + width : a - width;
        }
      }
    }
  }
  return wedges;
}
