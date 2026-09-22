import { expect, type Page } from '@playwright/test';

/** ページを開き、スタート画面が出るまで待つ。コンソールエラーを集める */
export async function openMuseum(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`/${query}`);
  await page.waitForFunction(() => !!window.__OIM__, null, { timeout: 60_000 });
  return errors;
}

export async function waitForMode(page: Page, mode: string): Promise<void> {
  await page.waitForFunction((m) => window.__OIM__?.getState().mode === m, mode, {
    timeout: 60_000,
  });
}

export async function enterMuseum(page: Page): Promise<void> {
  await expect(page.getByTestId('enter')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('enter').click();
  await waitForMode(page, 'walking');
}
