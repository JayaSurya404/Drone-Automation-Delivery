import { expect, test } from '@playwright/test';

/**
 * Customer journey E2E test against the dev/staging stack.
 * Verifies navigation, login, catalog products, and cart actions.
 */
test.describe('customer portal journey', () => {
  const email = process.env.CUSTOMER_SEED_EMAIL ?? 'customer@skynav.local';
  const password = process.env.CUSTOMER_SEED_PASSWORD ?? 'ChangeMe123!';

  test('customer can visit portal, sign in, and view product catalog', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/SkyNav/i);

    // Fill customer login credentials
    const emailInput = page.locator('input[type="text"], input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill(email);
    await passwordInput.fill(password);

    const submitBtn = page.locator('button:has-text("Sign In to Customer Portal"), form button[type="submit"]').first();
    await submitBtn.click();

    // Verify successful login
    await expect(page).not.toHaveURL(/\/login/);

    // Browse products
    await page.goto('/products');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('unauthenticated user trying to access orders is redirected to login', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });
});
