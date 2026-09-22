import { describe, expect, it } from 'vitest';
import {
  LIGHT,
  SHADOW,
  TARGET_GRAY,
  TILE,
  TILE_A,
  TILE_B,
  boardValue,
  isLightTile,
  linearToSrgb,
  shadeAt,
  srgbToLinear,
  tileCenter,
} from '../../src/exhibits/b3-checker-shadow/board';

describe('B-3 チェッカーシャドウの盤面', () => {
  it('A は暗いタイル、B は明るいタイル', () => {
    expect(isLightTile(TILE_A)).toBe(false);
    expect(isLightTile(TILE_B)).toBe(true);
  });

  it('A は影の外、B は本影の中', () => {
    const a = tileCenter(TILE_A);
    const b = tileCenter(TILE_B);
    expect(shadeAt(a.u, a.v)).toBeCloseTo(1, 12);
    expect(shadeAt(b.u, b.v)).toBeCloseTo(SHADOW, 12);
  });

  it('A と B の中心の画素値が完全に一致する（#787878）', () => {
    const a = tileCenter(TILE_A);
    const b = tileCenter(TILE_B);
    expect(boardValue(a.u, a.v)).toBe(TARGET_GRAY);
    expect(boardValue(b.u, b.v)).toBe(TARGET_GRAY);
  });

  it('A と B のタイルの中央部は一様（フィルタリングで値がずれない）', () => {
    for (const t of [TILE_A, TILE_B]) {
      const c = tileCenter(t);
      for (const du of [-0.15, 0, 0.15]) {
        for (const dv of [-0.15, 0, 0.15]) {
          expect(boardValue(c.u + du * TILE, c.v + dv * TILE)).toBe(TARGET_GRAY);
        }
      }
    }
  });

  it('影の中の明るいタイルは、影の外の明るいタイルより暗い', () => {
    expect(TARGET_GRAY).toBeLessThan(LIGHT);
    expect(SHADOW).toBeLessThan(1);
  });

  it('sRGB と線形の変換は 8 bit で往復する', () => {
    for (let c = 0; c <= 255; c++) expect(linearToSrgb(srgbToLinear(c))).toBe(c);
  });
});
