import { test, expect, type Page } from '@playwright/test';
import { enterMuseum, openMuseum, waitForMode } from './helpers';

async function openAndSettle(page: Page, id: string): Promise<void> {
  await page.evaluate((i) => window.__OIM__!.openExhibit(i as never), id);
  await waitForMode(page, 'viewing');
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__OIM__!.nextFrame());
}

test.describe('視点に依存する作品の画素・位置の検証', () => {
  test('B-3: A と B の中心の画素値が一致する', async ({ page }) => {
    await openMuseum(page);
    await enterMuseum(page);
    await openAndSettle(page, 'checker-shadow');
    const { a, b } = await page.evaluate(() => {
      const api = window.__OIM__!;
      const p = api.debugPoints('checker-shadow');
      return { a: api.readPixel(p.tileA!.x, p.tileA!.y), b: api.readPixel(p.tileB!.x, p.tileB!.y) };
    });
    for (let i = 0; i < 3; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThanOrEqual(1);
    // 設計値 #787878（sRGB 120）
    expect(Math.abs(a[0]! - 120)).toBeLessThanOrEqual(2);
    expect(a[0]).toBe(a[1]);
  });

  test('B-2: 推奨視点から見ると、三角形の途切れた両端が画面上で重なる', async ({ page }) => {
    await openMuseum(page);
    await enterMuseum(page);
    await openAndSettle(page, 'impossible-triangle');
    const p = await page.evaluate(() => window.__OIM__!.debugPoints('impossible-triangle'));
    expect(Math.hypot(p.cornerA!.x - p.cornerE!.x, p.cornerA!.y - p.cornerE!.y)).toBeLessThan(0.5);
  });

  test('B-1: 同じ大きさの人形が、覗き穴からは 2 倍以上違う大きさに見える', async ({ page }) => {
    await openMuseum(page);
    await enterMuseum(page);
    await openAndSettle(page, 'ames-room');
    const p = await page.evaluate(() => window.__OIM__!.debugPoints('ames-room'));
    const left = Math.abs(p.dollLeftFoot!.y - p.dollLeftTop!.y);
    const right = Math.abs(p.dollRightFoot!.y - p.dollRightTop!.y);
    expect(right / left).toBeGreaterThan(2);
  });
});
