import { test, expect } from '@playwright/test';
import { openMuseum, waitForMode } from './helpers';

test('起動するとコンソールエラーなしで WebGL2 のキャンバスとスタート画面が表示される', async ({
  page,
}) => {
  const errors = await openMuseum(page);
  await waitForMode(page, 'start');
  await expect(page.locator('#app canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: '錯視美術館' })).toBeVisible();
  await expect(page.getByTestId('enter')).toBeVisible();

  const isWebGL2 = await page.evaluate(() => {
    const c = document.querySelector('#app canvas') as HTMLCanvasElement | null;
    return !!c?.getContext('webgl2');
  });
  expect(isWebGL2).toBe(true);
  expect(errors).toEqual([]);
});
