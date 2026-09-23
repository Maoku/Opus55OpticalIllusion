import { test, expect } from '@playwright/test';
import { enterMuseum, openMuseum, waitForMode } from './helpers';

test.describe('フロアマップと設定', () => {
  test('M でフロアマップを開き、作品を選ぶとその鑑賞モードへワープする', async ({ page }) => {
    const errors = await openMuseum(page);
    await enterMuseum(page);
    await page.keyboard.press('m');
    await waitForMode(page, 'map');
    await expect(page.getByTestId('floor-map')).toBeVisible();
    await page.getByTestId('map-item-checker-shadow').click();
    await waitForMode(page, 'viewing');
    await expect(page.getByTestId('panel-title')).toHaveText('チェッカーシャドウ');
    await expect(page.getByTestId('hint-body')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('Esc でフロアマップを閉じると歩行に戻る', async ({ page }) => {
    await openMuseum(page);
    await enterMuseum(page);
    await page.keyboard.press('m');
    await waitForMode(page, 'map');
    await page.keyboard.press('Escape');
    await waitForMode(page, 'walking');
  });

  test('一時停止から設定を開き、設定と鑑賞の記録は再読み込み後も残る', async ({ page }) => {
    await openMuseum(page);
    await enterMuseum(page);
    // Esc でポインタロックが外れたときと同じ状態にする
    await page.evaluate(() => document.exitPointerLock());
    await waitForMode(page, 'paused');
    await page.getByRole('button', { name: '設定' }).click();
    await waitForMode(page, 'settings');
    await page.locator('#set-reduced').check();
    await page.locator('#set-fov').fill('80');
    await page.getByTestId('settings-close').click();
    await waitForMode(page, 'paused');
    await page.evaluate(() => window.__OIM__!.openExhibit('ebbinghaus'));
    await waitForMode(page, 'viewing');

    await page.reload();
    await page.waitForFunction(() => !!window.__OIM__, null, { timeout: 60_000 });
    await waitForMode(page, 'start');
    const s = await page.evaluate(() => window.__OIM__!.getState());
    expect(s.settings.reducedMotion).toBe(true);
    expect(s.settings.fov).toBe(80);
    expect(s.visited).toContain('ebbinghaus');
    await expect(page.locator('#start-reduced')).toBeChecked();
  });

  test('動きを減らす設定でも、鑑賞モードへ移れる（カメラ移動はフェード）', async ({ page }) => {
    await openMuseum(page);
    await page.locator('#start-reduced').check();
    await enterMuseum(page);
    await page.evaluate(() => window.__OIM__!.openExhibit('cafe-wall'));
    await waitForMode(page, 'viewing');
    await expect(page.getByTestId('panel-title')).toHaveText('カフェウォール錯視');
    expect(await page.evaluate(() => window.__OIM__!.getState().settings.reducedMotion)).toBe(true);
  });
});
