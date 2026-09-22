import { describe, expect, it } from 'vitest';
import { Tweens, ease } from '../../src/core/tween';

describe('Tweens', () => {
  it('経過時間に応じて進み、完了すると true で解決する', async () => {
    const t = new Tweens();
    const values: number[] = [];
    const p = t.run(1, (k) => values.push(k), { ease: ease.linear });
    t.update(0.5);
    t.update(0.6);
    await expect(p).resolves.toBe(true);
    expect(values).toEqual([0, 0.5, 1]);
    expect(t.active).toBe(0);
  });

  it('中断すると false で解決し、それ以上進まない', async () => {
    const t = new Tweens();
    const ac = new AbortController();
    let last = -1;
    const p = t.run(1, (k) => (last = k), { signal: ac.signal, ease: ease.linear });
    t.update(0.25);
    ac.abort();
    t.update(0.5);
    await expect(p).resolves.toBe(false);
    expect(last).toBe(0.25);
  });

  it('長さ 0 はすぐに最終値になる', async () => {
    const t = new Tweens();
    let last = -1;
    await expect(t.run(0, (k) => (last = k))).resolves.toBe(true);
    expect(last).toBe(1);
  });
});
