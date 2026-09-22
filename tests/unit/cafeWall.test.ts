import { describe, expect, it } from 'vitest';
import { cafeWallPattern, CAFE_WALL_DEFAULTS } from '../../src/exhibits/a1-cafe-wall/pattern';

describe('A-1 カフェウォールの図形', () => {
  const p = cafeWallPattern();

  it('目地はすべて水平で、同じ幅・同じ太さ（互いに平行）', () => {
    expect(p.mortarLines.length).toBe(CAFE_WALL_DEFAULTS.rows - 1);
    for (const m of p.mortarLines) {
      expect(m.x).toBeCloseTo(p.field.x);
      expect(m.w).toBeCloseTo(p.field.w);
      expect(m.h).toBeCloseTo(CAFE_WALL_DEFAULTS.mortar);
    }
    const gaps = p.mortarLines.slice(1).map((m, i) => m.y - p.mortarLines[i]!.y);
    for (const g of gaps) expect(g).toBeCloseTo(1 + CAFE_WALL_DEFAULTS.mortar);
  });

  it('1 行おきにタイルが半分ずつずれている', () => {
    p.rowShifts.forEach((s, r) => expect(s).toBe(r % 2 === 0 ? 0 : 0.5));
  });

  it('各行で黒いタイルが領域の半分を占める', () => {
    for (let r = 0; r < CAFE_WALL_DEFAULTS.rows; r++) {
      const y = p.field.y + r * (1 + CAFE_WALL_DEFAULTS.mortar);
      const blackWidth = p.blackTiles
        .filter((t) => Math.abs(t.y - y) < 1e-9)
        .reduce((s, t) => s + t.w, 0);
      expect(blackWidth).toBeCloseTo(p.field.w / 2);
    }
  });

  it('タイルは領域からはみ出さない', () => {
    for (const t of p.blackTiles) {
      expect(t.x).toBeGreaterThanOrEqual(p.field.x - 1e-9);
      expect(t.x + t.w).toBeLessThanOrEqual(p.field.x + p.field.w + 1e-9);
    }
  });

  it('ずれを 0 にすると全行のタイルが縦にそろう（デモの最終状態）', () => {
    const q = cafeWallPattern({ shift: 0 });
    const xs = (r: number) => {
      const y = q.field.y + r * (1 + CAFE_WALL_DEFAULTS.mortar);
      return q.blackTiles
        .filter((t) => Math.abs(t.y - y) < 1e-9)
        .map((t) => t.x)
        .sort((a, b) => a - b);
    };
    expect(xs(1)).toEqual(xs(0));
  });
});
