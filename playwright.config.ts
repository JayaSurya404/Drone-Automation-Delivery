import { defineConfig } from '@playwright/test';

const CUSTOMER_WEB_URL = process.env.E2E_CUSTOMER_WEB_URL ?? 'http://localhost:5173';
const ADMIN_WEB_URL = process.env.E2E_ADMIN_WEB_URL ?? 'http://localhost:5174';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'customer', testMatch: /customer\/.*\.spec\.ts/, use: { baseURL: CUSTOMER_WEB_URL } },
    { name: 'admin', testMatch: /admin\/.*\.spec\.ts/, use: { baseURL: ADMIN_WEB_URL } },
  ],
});
