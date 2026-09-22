import { describe, expect, it } from 'vitest';
import {
  ALBEDO,
  AMBIENT,
  CYAN_LIGHT,
  DIFFUSE,
  WHITE_LIGHT,
  isRedDominant,
  isSafe,
  lit,
  toSrgb8,
} from '../../src/exhibits/c2-colorless-fruit/palette';

describe('C-2 色のない果実の色設計', () => {
  it.each(Object.entries(ALBEDO))(
    '%s: シアンの照明では R ≤ min(G, B)（赤が優位にならない）',
    (_n, a) => {
      for (const k of [AMBIENT, AMBIENT + DIFFUSE * 0.5, AMBIENT + DIFFUSE]) {
        const c = lit(a, CYAN_LIGHT, k);
        expect(isSafe(c)).toBe(true);
        expect(isRedDominant(toSrgb8(c))).toBe(false);
      }
    },
  );

  it('2 つの面の色を混ぜても（アンチエイリアス）赤が優位にならない', () => {
    const colors = Object.values(ALBEDO).map((a) => lit(a, CYAN_LIGHT, AMBIENT + DIFFUSE));
    for (const p of colors) {
      for (const q of colors) {
        for (const t of [0.25, 0.5, 0.75]) {
          const m = [0, 1, 2].map((i) => p[i]! * (1 - t) + q[i]! * t) as unknown as [
            number,
            number,
            number,
          ];
          expect(isSafe(m)).toBe(true);
        }
      }
    }
  });

  it('白い照明では、イチゴとリンゴは赤い', () => {
    for (const name of ['strawberry', 'apple', 'cherry'] as const) {
      expect(isRedDominant(toSrgb8(lit(ALBEDO[name], WHITE_LIGHT, AMBIENT + DIFFUSE)), 40)).toBe(
        true,
      );
    }
  });

  it('シアンの照明では、果物はほぼ無彩色（灰色）', () => {
    const c = toSrgb8(lit(ALBEDO.strawberry, CYAN_LIGHT, AMBIENT + DIFFUSE));
    expect(Math.max(...c) - Math.min(...c)).toBeLessThan(10);
  });
});
