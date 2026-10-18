import { defineConfig, devices } from '@playwright/test';

// Tests run against the built site served as static files (stage-01 in 09 環境ごとの公開計画).
// The second server serves the same page built from tests/fixtures/after-release.json.
const chromium = process.env.CHROMIUM_PATH;
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:4321',
    launchOptions: { args: ['--no-proxy-server'], ...(chromium ? { executablePath: chromium } : {}) },
  },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    { command: 'node tests/serve.mjs dist 4321', url: 'http://localhost:4321', reuseExistingServer: true },
    { command: 'node tests/serve.mjs dist-variant 4322', url: 'http://localhost:4322', reuseExistingServer: true },
  ],
});
