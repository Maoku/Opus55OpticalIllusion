import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { enterMuseum, openMuseum, waitForMode } from './helpers';

const SHOT_DIR = 'Docs/screenshots';

test('全作品の巡回: ヒントは非表示 → ボタンで表示 → スクリーンショット', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  mkdirSync(SHOT_DIR, { recursive: true });
  const errors = await openMuseum(page);
  await enterMuseum(page);
  const ids = await page.evaluate(() => window.__OIM__!.exhibitIds());
  expect(ids.length).toBeGreaterThan(0);

  for (const id of ids) {
    await page.evaluate((i) => window.__OIM__!.openExhibit(i), id);
    await waitForMode(page, 'viewing');
    await expect(page.getByTestId('hint-body')).toBeHidden();
    await page.evaluate(() => window.__OIM__!.nextFrame());
    await page.screenshot({ path: `${SHOT_DIR}/${id}.png` });

    await page.getByTestId('hint-toggle').click();
    await expect(page.getByTestId('appearance')).toBeVisible();
    await page.getByTestId('mechanism-toggle').click();
    await expect(page.getByTestId('mechanism')).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/${id}--hint.png` });

    // 種明かしデモを少し再生して止める
    const demo = page.getByTestId('demo');
    if (await demo.isVisible()) {
      await demo.click();
      await expect
        .poll(() => page.evaluate(() => window.__OIM__!.getState().demoPlaying))
        .toBe(true);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOT_DIR}/${id}--demo.png` });
      if (await page.evaluate(() => window.__OIM__!.getState().demoPlaying)) await demo.click();
      await expect
        .poll(() => page.evaluate(() => window.__OIM__!.getState().demoPlaying))
        .toBe(false);
    }
    await page.getByTestId('hint-toggle').click();
  }
  expect(errors).toEqual([]);
});
