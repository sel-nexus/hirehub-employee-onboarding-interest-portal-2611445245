/** Configure frontend-local browser journeys against a production preview. */
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 5000 },
  outputDir: './test-results',
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
    timeout: 30000,
    cwd: fileURLToPath(new URL('.', import.meta.url)),
  },
});
