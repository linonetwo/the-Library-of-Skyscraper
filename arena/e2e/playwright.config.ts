import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1600, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
});
