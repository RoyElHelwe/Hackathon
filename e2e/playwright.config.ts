import { defineConfig, devices } from '@playwright/test';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:4000';
const e2eEnv = { AI_PROVIDER: 'mock', CLASSROOM_PROVIDER: 'fake', DEV_LOGIN: 'true', AI_CACHE: 'false' };

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(student-golden-path|peer-review|parent|rtl)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @tajriba/api dev',
      url: `${API}/health`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: e2eEnv,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @tajriba/web dev',
      url: `${WEB}/login`,
      reuseExistingServer: true,
      timeout: 180_000,
      cwd: '..',
    },
  ],
});
