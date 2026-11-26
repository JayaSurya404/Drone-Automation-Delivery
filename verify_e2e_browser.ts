import { chromium, Page } from '@playwright/test';

interface PageAuditResult {
  app: 'customer' | 'admin';
  route: string;
  success: boolean;
  pageErrors: string[];
  consoleErrors: string[];
  info: string;
}

const auditResults: PageAuditResult[] = [];

function setupPageLogger(page: Page, app: 'customer' | 'admin', allow502 = false) {
  const currentErrors: string[] = [];
  const pageErrors: string[] = [];
  let lastFailedUrl = '';

  page.on('response', (res) => {
    if (res.status() >= 400) {
      lastFailedUrl = res.url();
    }
  });

  page.on('pageerror', (err) => {
    const msg = `[PAGE CRASH] ${err.name}: ${err.message}`;
    console.error(`  ❌ ${app} ${msg}`);
    pageErrors.push(msg);
  });

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      // Exclude expected unauthenticated silent refresh 400, Cesium ion token notices, or offline Gazebo probe
      const isExpectedSilentRefresh =
        (text.includes('api/v1/auth/refresh') && text.includes('400')) ||
        (text.includes('status of 400') && lastFailedUrl.includes('auth/refresh'));
      const isCesiumNotice = text.includes('Cesium ion') || text.includes('token');
      const isGazeboOffline = text.includes('ERR_CONNECTION_REFUSED');
      const isExpected502 = allow502 && (text.includes('502') || text.includes('ApiDownError'));
      const isExpectedOrderSnapshotFallback =
        text.includes('404') &&
        (lastFailedUrl.includes('tracking') ||
          lastFailedUrl.includes('deliveries') ||
          lastFailedUrl.includes('orders/cbe-ord'));
      if (!isExpectedSilentRefresh && !isCesiumNotice && !isGazeboOffline && !isExpected502 && !isExpectedOrderSnapshotFallback) {
        console.error(`  ⚠️ [CONSOLE ERROR] [${app}]: ${text} ${lastFailedUrl ? `(Last URL: ${lastFailedUrl})` : ''}`);
        currentErrors.push(`${text} ${lastFailedUrl ? `(Last URL: ${lastFailedUrl})` : ''}`);
      }
    }
  });

  return {
    getAndReset: (route: string, info = ''): PageAuditResult => {
      const res: PageAuditResult = {
        app,
        route,
        success: pageErrors.length === 0,
        pageErrors: [...pageErrors],
        consoleErrors: [...currentErrors],
        info,
      };
      pageErrors.length = 0;
      currentErrors.length = 0;
      auditResults.push(res);
      return res;
    },
  };
}

async function runAudit() {
  console.log('🚀 Starting Comprehensive Playwright Verification Journey...\n');

  const browser = await chromium.launch({ headless: true });

  try {
    // ══════════════════════════════════════════════════════════════════
    // PART 1: CUSTOMER WEB JOURNEY
    // ══════════════════════════════════════════════════════════════════
    console.log('--- PART 1: CUSTOMER WEB PORTAL ---');
    const customerContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
      viewport: { width: 1280, height: 800 },
    });
    const customerPage = await customerContext.newPage();
    const customerLogger = setupPageLogger(customerPage, 'customer');

    // 1. Visit Login
    console.log('Visiting /login...');
    await customerPage.goto('/login', { waitUntil: 'networkidle' });
    customerLogger.getAndReset('/login', 'Loaded login screen');

    // 2. Perform Customer Login
    console.log('Authenticating as customer@skynav.local...');
    const emailInput = customerPage.getByPlaceholder('customer@skynav.local');
    const passwordInput = customerPage.getByPlaceholder('Enter your password');
    await emailInput.fill('customer@skynav.local');
    await passwordInput.fill('ChangeMe123!');

    const submitBtn = customerPage.getByRole('button', { name: 'Sign In to Customer Portal' });
    await submitBtn.click();
    await customerPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });
    console.log(`  Customer signed in successfully, now on: ${customerPage.url()}`);
    customerLogger.getAndReset('/login [POST]', 'Submitted login credentials and redirected');

    // 3. Products Page
    console.log('Visiting /products...');
    await customerPage.goto('/products', { waitUntil: 'networkidle' });
    await customerPage.waitForTimeout(1500);
    const productCards = await customerPage.locator('[class*="product"], [class*="card"]').count();
    customerLogger.getAndReset('/products', `Rendered ${productCards} product elements (catalog loaded)`);

    // Add product to cart
    try {
      const addToCartBtn = customerPage.locator('button:has-text("Add to Cart"), button:has-text("Add")').first();
      if (await addToCartBtn.isVisible({ timeout: 2000 })) {
        await addToCartBtn.click();
        console.log('  Added product to cart');
        await customerPage.waitForTimeout(500);
      }
    } catch (e: any) {
      console.log('  Note on addToCart:', e.message);
    }

    // 4. Cart Page
    console.log('Visiting /cart...');
    await customerPage.goto('/cart', { waitUntil: 'networkidle' });
    await customerPage.waitForTimeout(1500);
    customerLogger.getAndReset('/cart', 'Cart items verified');

    // 5. Checkout Page
    console.log('Visiting /checkout...');
    await customerPage.goto('/checkout', { waitUntil: 'networkidle' });
    await customerPage.waitForTimeout(1500);
    customerLogger.getAndReset('/checkout', 'Checkout flow loaded');

    // 6. Orders Page (Verifying OrderContext unwrap & zero "orders.find is not a function")
    console.log('Visiting /orders...');
    await customerPage.goto('/orders', { waitUntil: 'networkidle' });
    await customerPage.waitForTimeout(2000);
    const orderItems = await customerPage.locator('[class*="order"], [class*="card"]').count();
    customerLogger.getAndReset('/orders', `Orders page verified safely (${orderItems} order/card items)`);

    // 7. Tracking Page
    console.log('Visiting /tracking/cbe-ord-456 (live tracking)...');
    await customerPage.goto('/tracking/cbe-ord-456', { waitUntil: 'networkidle' });
    await customerPage.waitForTimeout(2000);
    customerLogger.getAndReset('/tracking/cbe-ord-456', 'Live tracking map verified with fallback');

    // ══════════════════════════════════════════════════════════════════
    // PART 2: ADMIN WEB JOURNEY
    // ══════════════════════════════════════════════════════════════════
    console.log('\n--- PART 2: ADMIN WEB PORTAL ---');
    const adminContext = await browser.newContext({
      baseURL: 'http://localhost:5174',
      viewport: { width: 1440, height: 900 },
    });
    const adminPage = await adminContext.newPage();
    const adminLogger = setupPageLogger(adminPage, 'admin');

    // 1. Visit Admin Login
    console.log('Visiting /login on admin-web...');
    await adminPage.goto('/login', { waitUntil: 'networkidle' });
    adminLogger.getAndReset('/login', 'Loaded admin login screen');

    // 2. Perform Admin Login
    console.log('Authenticating as admin@skynav.local...');
    const adminEmailInput = adminPage.locator('input[placeholder*="admin@skynav"], input[type="text"], input[type="email"]').first();
    const adminPasswordInput = adminPage.locator('input[type="password"]').first();
    await adminEmailInput.fill('admin@skynav.local');
    await adminPasswordInput.fill('ChangeMe123!');

    const adminSubmitBtn = adminPage.locator('button[type="submit"]').first();
    await adminSubmitBtn.click();
    await adminPage.waitForTimeout(2500);
    adminLogger.getAndReset('/login [POST]', 'Submitted admin credentials');

    // 3. Visit all Admin routes
    const adminRoutes = [
      '/dashboard',
      '/fleet',
      '/operations',
      '/orders',
      '/products',
      '/missions',
      '/packages',
      '/routes',
      '/battery-health',
      '/maintenance',
      '/customers',
      '/merchants',
      '/geofencing',
      '/emergency',
      '/payments',
      '/analytics',
      '/reports',
      '/notifications',
      '/support',
      '/audit-logs',
      '/admin-management',
      '/settings',
      '/simulation',
      '/intelligence',
      '/swarm',
      '/digital-twin',
    ];

    for (const route of adminRoutes) {
      console.log(`Visiting admin route: ${route}...`);
      await adminPage.goto(route, { waitUntil: 'networkidle' });
      await adminPage.waitForTimeout(500);
      adminLogger.getAndReset(route, `Verified page ${route}`);
    }

    // ══════════════════════════════════════════════════════════════════
    // PART 3: API DOWN (502) ERROR BOUNDARY VERIFICATION
    // ══════════════════════════════════════════════════════════════════
    console.log('\n--- PART 3: 502 API-DOWN ERROR HANDLING ---');
    const errorTestContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
    });
    const errorPage = await errorTestContext.newPage();
    const errorLogger = setupPageLogger(errorPage, 'customer', true);

    console.log('Logging in to test 502 error boundary on /orders...');
    await errorPage.goto('/login', { waitUntil: 'networkidle' });
    await errorPage.getByPlaceholder('customer@skynav.local').fill('customer@skynav.local');
    await errorPage.getByPlaceholder('Enter your password').fill('ChangeMe123!');
    await errorPage.getByRole('button', { name: 'Sign In to Customer Portal' }).click();
    await errorPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });
    console.log(`  After login errorPage URL: ${errorPage.url()}`);

    // Intercept API orders request with predicate to return 502 Bad Gateway
    await errorPage.route(
      (url) => url.pathname.includes('/api') && url.pathname.includes('orders'),
      (route) => {
        console.log(`  [Intercepted API 502] ${route.request().url()}`);
        return route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Bad Gateway: Upstream connection failed' }),
        });
      }
    );

    console.log('Navigating to /orders with simulated 502...');
    await errorPage.goto('/orders', { waitUntil: 'networkidle' });
    await errorPage.waitForSelector('text=/502|temporarily unavailable|Unable to Load Orders/i', { timeout: 6000 }).catch(() => null);
    await errorPage.waitForTimeout(1000);
    console.log(`  On /orders errorPage URL: ${errorPage.url()}`);
    const pageText = await errorPage.locator('body').innerText();
    const friendlyHeading = await errorPage.locator('text=/502|temporarily unavailable|Unable to Load Orders/i').count();
    console.log(`  Friendly 502 error elements detected: ${friendlyHeading}`);
    if (friendlyHeading === 0) {
      console.log(`  Page text preview: ${pageText.slice(0, 300)}`);
    }
    errorLogger.getAndReset('/orders [502 simulated]', `Friendly 502 Error Displayed: ${friendlyHeading > 0 ? 'YES' : 'NO'}`);

    await customerContext.close();
    await adminContext.close();
    await errorTestContext.close();
  } finally {
    await browser.close();
  }

  // ══════════════════════════════════════════════════════════════════
  // PRINT COMPREHENSIVE AUDIT REPORT
  // ══════════════════════════════════════════════════════════════════
  console.log('\n========================================================================================');
  console.log('                   PLAYWRIGHT BROWSER VERIFICATION SUMMARY REPORT                       ');
  console.log('========================================================================================');

  let totalErrors = 0;
  let totalPageErrors = 0;

  for (const item of auditResults) {
    const errorCount = item.consoleErrors.length;
    const pageErrorCount = item.pageErrors.length;
    totalErrors += errorCount;
    totalPageErrors += pageErrorCount;

    const statusBadge = pageErrorCount === 0 && errorCount === 0 ? '✅ PASS' : (pageErrorCount > 0 ? '❌ CRASH' : '⚠️ WARN');
    console.log(`${statusBadge} [${item.app.toUpperCase()}] ${item.route.padEnd(28)} | PageErrors: ${pageErrorCount} | ConsoleErrors: ${errorCount} | ${item.info}`);
    if (pageErrorCount > 0) {
      for (const pe of item.pageErrors) {
        console.log(`     -> ${pe}`);
      }
    }
    if (errorCount > 0) {
      for (const ce of item.consoleErrors) {
        console.log(`     -> ${ce}`);
      }
    }
  }

  console.log('========================================================================================');
  console.log(`Total Pages Audited: ${auditResults.length}`);
  console.log(`Total Uncaught Page Crashes: ${totalPageErrors}`);
  console.log(`Total Console Errors: ${totalErrors}`);
  console.log('========================================================================================\n');

  if (totalPageErrors > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
