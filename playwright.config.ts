import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'tests/e2e/.results',
  use: {
    baseURL: 'http://localhost:5175',
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'],
    },
  },
  webServer: {
    command: 'LAVRA_NOHMR=1 npx vite',
    url: 'http://localhost:5175',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
