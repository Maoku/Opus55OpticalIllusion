import { test, expect } from '@playwright/test';
import { enterMuseum, openMuseum } from './helpers';

test.describe('歩行', () => {
  test('入館すると歩行モードになり、前へ歩ける', async ({ page }) => {
    await openMuseum(page);
    await enterMuseum(page);
    const before = await page.evaluate(() => window.__OIM__!.getPlayer());
    // ソフトウェア描画ではフレームレートが低く実時間あたりの移動量が小さいので、進むまで押し続ける
    // yaw = 0 は北（-Z）向き
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.__OIM__!.hold('KeyW', 1000));
          return (await page.evaluate(() => window.__OIM__!.getPlayer())).z;
        },
        { timeout: 30_000 },
      )
      .toBeLessThan(before.z - 0.3);
    const after = await page.evaluate(() => window.__OIM__!.getPlayer());
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.05);
  });

  test('壁を通り抜けない', async ({ page }) => {
    await openMuseum(page);
    await enterMuseum(page);
    // Zone A の西の壁（x = -44）の手前で西を向く
    await page.evaluate(() => window.__OIM__!.teleport(-43.5, 3, Math.PI / 2));
    await page.evaluate(() => window.__OIM__!.hold('KeyW', 3000));
    const p = await page.evaluate(() => window.__OIM__!.getPlayer());
    expect(p.x).toBeGreaterThanOrEqual(-44 + 0.3 - 1e-3);
    const state = await page.evaluate(() => window.__OIM__!.getState());
    expect(state.zoneId).toBe('zoneA');
  });
});
