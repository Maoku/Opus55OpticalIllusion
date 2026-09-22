import { test, expect } from '@playwright/test';
import { enterMuseum, openMuseum, waitForMode } from './helpers';

test.describe('鑑賞とヒント', () => {
  test('A-1: ヒントは初期状態で非表示で、ボタンを押すと 2 段階で表示される', async ({ page }) => {
    const errors = await openMuseum(page);
    await enterMuseum(page);
    await page.evaluate(() => window.__OIM__!.openExhibit('cafe-wall'));
    await waitForMode(page, 'viewing');

    const panel = page.getByTestId('exhibit-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('panel-title')).toHaveText('カフェウォール錯視');
    await expect(page.getByTestId('how-to-view')).toBeVisible();

    const toggle = page.getByTestId('hint-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('hint-body')).toBeHidden();
    await expect(page.getByTestId('appearance')).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('appearance')).toBeVisible();
    await expect(page.getByTestId('mechanism-body')).toBeHidden();

    await page.getByTestId('mechanism-toggle').click();
    await expect(page.getByTestId('mechanism')).toBeVisible();

    // デモを再生して止める
    await page.getByTestId('demo').click();
    await expect.poll(() => page.evaluate(() => window.__OIM__!.getState().demoPlaying)).toBe(true);
    await page.getByTestId('demo').click();
    await expect
      .poll(() => page.evaluate(() => window.__OIM__!.getState().demoPlaying))
      .toBe(false);

    // ヒントを隠す → 再訪すると閉じた状態から始まる
    await toggle.click();
    await expect(page.getByTestId('hint-body')).toBeHidden();
    await page.getByTestId('close-exhibit').click();
    await expect
      .poll(() => page.evaluate(() => window.__OIM__!.getState().mode))
      .not.toBe('viewing');
    await page.evaluate(() => window.__OIM__!.openExhibit('cafe-wall'));
    await expect(page.getByTestId('hint-body')).toBeHidden();
    await expect(page.getByText('ヒント閲覧済み')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('キーボード H でヒントを開閉できる', async ({ page }) => {
    await openMuseum(page);
    await enterMuseum(page);
    await page.evaluate(() => window.__OIM__!.openExhibit('cafe-wall'));
    await waitForMode(page, 'viewing');
    await page.keyboard.press('h');
    await expect(page.getByTestId('appearance')).toBeVisible();
    await page.keyboard.press('h');
    await expect(page.getByTestId('hint-body')).toBeHidden();
  });

  test('ディープリンク ?exhibit= で作品の鑑賞モードが直接開く', async ({ page }) => {
    await openMuseum(page, '?exhibit=cafe-wall');
    await waitForMode(page, 'viewing');
    await expect(page.getByTestId('panel-title')).toHaveText('カフェウォール錯視');
    await expect(page.getByTestId('hint-body')).toBeHidden();
  });
});
