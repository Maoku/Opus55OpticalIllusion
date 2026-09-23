import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * E2E_BROWSERS=1 のとき、インストール済みの Google Chrome と Microsoft Edge でも
 * 主要なテスト（起動・鑑賞とヒント・画素の検証）を実行する
 */
const extraBrowsers = process.env.E2E_BROWSERS === '1';
const crossBrowserSpecs = /(smoke|exhibits|pixels).spec.ts/;

// ヘッドレス環境でも WebGL2 を使えるよう、ソフトウェアレンダラ（SwiftShader）を有効にする
const webglArgs = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: { args: webglArgs },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' },
      testMatch: /mobile\.spec\.ts/,
    },
    ...(extraBrowsers
      ? (['chrome', 'msedge'] as const).map((channel) => ({
          name: channel,
          testMatch: crossBrowserSpecs,
          use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 720 } },
        }))
      : []),
  ],
  webServer: {
    // E2E 用ビルド（debugApi を含む）を作って配信する
    command: `npx vite build --mode e2e --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
