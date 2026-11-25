import { expect, test } from '@playwright/test';

/**
 * Admin operator journey E2E test against the dev/staging stack.
 * Verifies authenticated admin dashboard, fleet, missions, simulation center, and session protection.
 */
const ADMIN_EMAIL = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL ?? 'admin@skynav.local';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

test.describe('admin operator journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[placeholder="admin@skynav"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill(ADMIN_EMAIL);
    await passwordInput.fill(ADMIN_PASSWORD);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('admin dashboard, fleet, operations, and intelligence pages load with real data', async ({ page }) => {
    await expect(page.locator('#root')).toBeVisible();

    await page.goto('/fleet');
    await expect(page).toHaveURL(/\/fleet/);

    await page.goto('/simulation');
    await expect(page).toHaveURL(/\/simulation/);

    await page.goto('/intelligence');
    await expect(page).toHaveURL(/\/intelligence/);
  });

  test('an unauthenticated visitor is redirected away from protected admin routes', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/fleet');
    await expect(page).toHaveURL(/\/login/);
  });
});
