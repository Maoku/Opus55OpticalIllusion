import { describe, expect, it } from 'vitest';
import { CENTER_R, ebbinghausPattern } from '../../src/exhibits/a2-ebbinghaus/pattern';
import {
  FIN_ANGLE,
  FIN_LENGTH,
  mullerLyerPattern,
  segmentLength,
} from '../../src/exhibits/a3-muller-lyer/pattern';
import { GRID_DEFAULTS, gridPattern } from '../../src/exhibits/a4-scintillating-grid/pattern';
import {
  BAND_WIDTHS,
  DRIFT_SEQUENCE,
  STATIC_SEQUENCE,
  driftWedges,
} from '../../src/exhibits/a5-peripheral-drift/pattern';
import {
  AFTER_SECONDS,
  FIXATION_SECONDS,
  complement,
  grayscale,
  luma,
  phaseAt,
  type Rgb,
} from '../../src/exhibits/a6-afterimage/pattern';

describe('A-2 エビングハウス', () => {
  it('2 つの中央の円の半径が等しい', () => {
    const p = ebbinghausPattern();
    expect(p.left.center.r).toBe(p.right.center.r);
    expect(p.left.center.r).toBe(CENTER_R);
  });

  it('左は大きな円、右は小さな円で囲む', () => {
    const p = ebbinghausPattern();
    expect(Math.min(...p.left.surround.map((c) => c.r))).toBeGreaterThan(CENTER_R);
    expect(Math.max(...p.right.surround.map((c) => c.r))).toBeLessThan(CENTER_R);
  });

  it('円どうしが重ならない', () => {
    const p = ebbinghausPattern();
    for (const g of [p.left, p.right]) {
      const all = [g.center, ...g.surround];
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i]!;
          const b = all[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
        }
      }
    }
  });

  it('デモの最終状態では中央の円が並び、半径は変わらない', () => {
    const p = ebbinghausPattern(1);
    expect(p.left.center.r).toBe(p.right.center.r);
    expect(p.right.center.x - p.left.center.x).toBeGreaterThan(2 * CENTER_R);
    expect(p.right.center.x - p.left.center.x).toBeLessThan(0.3);
  });
});

describe('A-3 ミュラー・リヤー', () => {
  const p = mullerLyerPattern();
  it('2 本の線分は同じ長さ', () => {
    expect(segmentLength(p.outward.shaft)).toBeCloseTo(segmentLength(p.inward.shaft), 12);
  });
  it('矢羽はすべて同じ長さ・同じ角度', () => {
    for (const f of [...p.outward.fins, ...p.inward.fins]) {
      expect(segmentLength(f)).toBeCloseTo(FIN_LENGTH, 12);
      expect(Math.abs(Math.atan2(f.y1 - f.y0, f.x1 - f.x0))).toSatisfy(
        (a: number) => Math.abs(a - FIN_ANGLE) < 1e-9 || Math.abs(a - (Math.PI - FIN_ANGLE)) < 1e-9,
      );
    }
  });
  it('外向きの矢羽は線分の外側へ、内向きは内側へ伸びる', () => {
    const { shaft } = p.outward;
    for (const f of p.outward.fins) {
      expect(f.x1 < shaft.x0 || f.x1 > shaft.x1).toBe(true);
    }
    for (const f of p.inward.fins) {
      expect(f.x1 > p.inward.shaft.x0 && f.x1 < p.inward.shaft.x1).toBe(true);
    }
  });
});

describe('A-4 きらめき格子', () => {
  const p = gridPattern();
  it('交点の数は線の本数の 2 乗', () => {
    expect(p.discs.length).toBe(GRID_DEFAULTS.lines ** 2);
  });
  it('白い円は線より太く、隣の交点とは重ならない', () => {
    expect(p.discRadius * 2).toBeGreaterThan(p.lineWidth);
    const pitch = p.positions[1]! - p.positions[0]!;
    expect(p.discRadius * 2).toBeLessThan(pitch / 2);
  });
  it('作品面からはみ出さない', () => {
    expect(p.extent.min).toBeGreaterThanOrEqual(0);
    expect(p.extent.max).toBeLessThanOrEqual(1);
  });
});

describe('A-5 周辺ドリフト', () => {
  it('区画は「黒 → 濃 → 白 → 淡」の順に、輪の向きへ並ぶ', () => {
    const wedges = driftWedges();
    for (let i = 0; i < 64; i += 4) {
      const seg = wedges.slice(i, i + 4);
      expect(seg.map((w) => w.step)).toEqual([...DRIFT_SEQUENCE]);
      const dir = seg[0]!.dir;
      for (let k = 1; k < 4; k++) {
        // 次の帯は輪の向きに進んだ位置にある
        const prevMid = (seg[k - 1]!.a0 + seg[k - 1]!.a1) / 2;
        const mid = (seg[k]!.a0 + seg[k]!.a1) / 2;
        expect(Math.sign(mid - prevMid)).toBe(dir);
      }
    }
  });
  it('帯の幅の合計は区画の幅に等しい', () => {
    expect(BAND_WIDTHS.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it('隣り合う輪は向きが逆', () => {
    const wedges = driftWedges();
    const d0 = wedges.filter((w) => w.cx === wedges[0]!.cx && w.cy === wedges[0]!.cy);
    const radii = [...new Set(d0.map((w) => w.r0))].sort((a, b) => a - b);
    const dirs = radii.map((r) => d0.find((w) => w.r0 === r)!.dir);
    for (let i = 1; i < dirs.length; i++) expect(dirs[i]).toBe(-dirs[i - 1]!);
  });
  it('デモ用の並びは左右対称（向きの手がかりがない）', () => {
    expect(STATIC_SEQUENCE[1]).toBe(STATIC_SEQUENCE[3]);
  });
});

describe('A-6 残像の窓', () => {
  const colors: Rgb[] = [
    [0.2, 0.5, 0.85],
    [0.9, 0.1, 0.15],
    [0.2, 0.6, 0.2],
  ];
  it('補色は輝度をほぼ保ち、色差の向きが反転する', () => {
    for (const c of colors) {
      const k = complement(c, 1);
      const clipped = c.some((v) => 2 * luma(c) - v < 0 || 2 * luma(c) - v > 1);
      // 色域の端で切り詰めた場合を除き、輝度は変わらない
      if (clipped) expect(Math.abs(luma(k) - luma(c))).toBeLessThan(0.1);
      else expect(luma(k)).toBeCloseTo(luma(c), 6);
      const y = luma(c);
      for (let i = 0; i < 3; i++) {
        if (Math.abs(c[i]! - y) > 1e-3) expect(Math.sign(k[i]! - y)).toBe(-Math.sign(c[i]! - y));
      }
    }
  });
  it('白黒版は元の色の輝度', () => {
    const g = grayscale([0.9, 0.1, 0.15]);
    expect(g[0]).toBe(g[1]);
    expect(g[1]).toBe(g[2]);
    expect(g[0]).toBeCloseTo(luma([0.9, 0.1, 0.15]));
  });
  it('見つめる → 白黒 → 待機の順に進む（切り替えは 1 回）', () => {
    expect(phaseAt(-1).phase).toBe('idle');
    expect(phaseAt(0).phase).toBe('fixate');
    expect(phaseAt(FIXATION_SECONDS - 0.01).phase).toBe('fixate');
    expect(phaseAt(FIXATION_SECONDS + 0.01).phase).toBe('after');
    expect(phaseAt(FIXATION_SECONDS + AFTER_SECONDS + 0.01).phase).toBe('idle');
  });
});
