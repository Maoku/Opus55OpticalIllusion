import { test, expect } from '@playwright/test';

test('起動するとコンソールエラーなしで WebGL2 のキャンバスが表示される', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  const canvas = page.locator('#app canvas');
  await expect(canvas).toBeVisible();

  const isWebGL2 = await page.evaluate(() => {
    const c = document.querySelector('#app canvas') as HTMLCanvasElement | null;
    const gl = c?.getContext('webgl2');
    return !!gl;
  });
  expect(isWebGL2).toBe(true);
  expect(errors).toEqual([]);
});
