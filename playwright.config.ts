import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-output/e2e-results.json' }],
    ['html', { outputFolder: 'test-output/e2e-report' }],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node scripts/preview-e2e.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
