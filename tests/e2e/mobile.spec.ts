import { test, expect } from '@playwright/test';
import { openMuseum, waitForMode } from './helpers';

test.describe('モバイル（iPhone 相当のビューポート）', () => {
  test('UI が画面内に収まり、スティックと下部シートで鑑賞できる', async ({ page }) => {
    const errors = await openMuseum(page);
    await waitForMode(page, 'start');
    const vw = page.viewportSize()!.width;
    // 横スクロールが出ない
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflow).toBeLessThanOrEqual(vw);
    await page.getByTestId('enter').click();
    await waitForMode(page, 'walking');
    await expect(page.getByTestId('stick')).toBeVisible();

    await page.evaluate(() => window.__OIM__!.openExhibit('cafe-wall'));
    await waitForMode(page, 'viewing');
    const panel = page.getByTestId('exhibit-panel');
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    const vh = page.viewportSize()!.height;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(vh + 1);
    // 下部シートは画面の半分以下
    expect(box.height).toBeLessThanOrEqual(vh * 0.46);

    await page.getByTestId('hint-toggle').tap();
    await expect(page.getByTestId('appearance')).toBeVisible();
    await page.screenshot({ path: 'Docs/screenshots/mobile-cafe-wall.png' });
    expect(errors).toEqual([]);
  });
});
