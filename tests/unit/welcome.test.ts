import { describe, expect, it } from 'vitest';
import {
  COLUMN,
  EYE,
  OPENING,
  PANEL,
  WALL_Z,
  floorHit,
  hitsColumn,
  hitsPanel,
} from '../../src/exhibits/e1-welcome-anamorphosis/design';

describe('E-1 ようこそ（アナモルフォーシス）の設計', () => {
  it('館名の帯のうち回廊の開口部に抜ける部分は、すべて吊りパネルが受け止める', () => {
    for (let x = OPENING.x0; x <= OPENING.x1; x += 0.1) {
      for (let y = 1.0; y <= 3.6; y += 0.1) {
        expect(hitsPanel({ x, y, z: WALL_Z }), `(${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
      }
    }
  });

  it('目のシンボルの高さ（4 m 以上）は開口部より上の垂れ壁に当たる', () => {
    const pitch = (Math.atan2(OPENING.top - EYE.y, EYE.z - WALL_Z) * 180) / Math.PI;
    expect(pitch).toBeLessThan(10.5);
  });

  it('床の文字は壁より手前の床に落ちる', () => {
    for (const pitch of [-8.1, -9.6, -11.2]) {
      const z = floorHit(pitch);
      expect(z).toBeGreaterThan(WALL_Z);
      expect(z).toBeLessThan(EYE.z);
    }
  });

  it('柱の陰になる壁の点は、柱の奥にあるときだけ遮られる', () => {
    const behind = { x: COLUMN.x * 2, y: 2, z: EYE.z + (COLUMN.z - EYE.z) * 2 };
    expect(hitsColumn(behind)).toBe(true);
    const front = { x: COLUMN.x * 0.5, y: 2, z: EYE.z + (COLUMN.z - EYE.z) * 0.5 };
    expect(hitsColumn(front)).toBe(false);
  });

  it('吊りパネルは開口部の前にあり、柱とは重ならない', () => {
    expect(PANEL.z).toBeGreaterThan(WALL_Z);
    expect(Math.abs(COLUMN.x) - COLUMN.r).toBeGreaterThan(PANEL.x1);
  });
});
