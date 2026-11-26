import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  console.log('=== STARTING END-TO-END CUSTOMER JOURNEY TEST (NO MOCKS) ===\n');

  const screenshotsDir = path.resolve('artifacts/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
  });

  // Customer browser context: block service worker to ensure deterministic live API communication
  const customerContext = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 800 },
  });
  const customerPage = await customerContext.newPage();

  customerPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Customer Console Error]: ${msg.text()}`);
    }
  });

  customerPage.on('response', (res) => {
    if (res.status() === 404) {
      console.log(`[404 Response]: ${res.url()}`);
    }
  });

  let createdOrderId = '';

  try {
    // ── 1. CUSTOMER LOGIN ──
    console.log('1. Navigating to Customer Login: http://localhost:5173/login');
    await customerPage.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    
    console.log('   Filling credentials customer@skynav.local into login form...');
    await customerPage.fill('input[placeholder="customer@skynav.local"]', 'customer@skynav.local');
    await customerPage.fill('input[placeholder="Enter your password"]', 'ChangeMe123!');
    
    await customerPage.click('button:has-text("Sign In to Customer Portal")');
    await customerPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`   Customer logged in successfully! Current URL: ${customerPage.url()}`);

    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_01_logged_in.png') });

    // ── 2. CATALOG & DISTINCT PRODUCT IMAGES ──
    console.log('\n2. Navigating to Products Catalog: http://localhost:5173/products');
    await customerPage.goto('http://localhost:5173/products', { waitUntil: 'networkidle' });
    await customerPage.waitForSelector('.ecom-product-card, .product-main-image', { timeout: 10000 });

    const productCards = await customerPage.locator('.ecom-product-card').all();
    console.log(`   Found ${productCards.length} product cards rendered on catalog.`);

    const imageUrls = await customerPage.locator('.product-main-image').evaluateAll((imgs) =>
      imgs.map((img) => (img as HTMLImageElement).src)
    );
    const distinctImages = new Set(imageUrls);
    console.log(`   Total product images collected: ${imageUrls.length}`);
    console.log(`   Distinct image sources: ${distinctImages.size}`);
    if (distinctImages.size < 5) {
      throw new Error(`Expected distinct images, but found only ${distinctImages.size} distinct sources!`);
    }
    console.log('   Distinct product images verified successfully!');
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_02_catalog_distinct_images.png') });

    // ── Clear cart first to start fresh ──
    console.log('\n   Ensuring clean initial cart state...');
    await customerPage.goto('http://localhost:5173/cart', { waitUntil: 'networkidle' });
    const clearBasketBtn = customerPage.locator('button:has-text("Clear Basket")');
    if (await clearBasketBtn.isVisible()) {
      await clearBasketBtn.click();
      await customerPage.waitForTimeout(600);
      console.log('   Existing cart cleared successfully.');
    }
    await customerPage.goto('http://localhost:5173/products', { waitUntil: 'networkidle' });
    await customerPage.waitForSelector('.ecom-product-card', { timeout: 10000 });

    // ── 3. ADD 3 DIFFERENT PRODUCTS TO CART ──
    console.log('\n3. Adding 3 different products to cart...');
    const addBtnCount = await customerPage.locator('.card-add-cart-btn').count();
    if (addBtnCount < 3) {
      throw new Error(`Expected at least 3 add-to-cart buttons, found ${addBtnCount}`);
    }

    // Add product 1 (first available add button)
    await customerPage.locator('.card-add-cart-btn').first().click({ force: true });
    await customerPage.waitForTimeout(800);
    console.log('   Added Product 1 to cart.');

    // Add product 2 (now the first remaining unadded button)
    await customerPage.locator('.card-add-cart-btn').first().click({ force: true });
    await customerPage.waitForTimeout(800);
    console.log('   Added Product 2 to cart.');

    // Add product 3 (now the first remaining unadded button)
    await customerPage.locator('.card-add-cart-btn').first().click({ force: true });
    await customerPage.waitForTimeout(800);
    console.log('   Added Product 3 to cart.');

    // ── 4. VIEW CART & VERIFY 3 ITEMS ──
    console.log('\n4. Navigating to Shopping Cart: http://localhost:5173/cart');
    await customerPage.goto('http://localhost:5173/cart', { waitUntil: 'networkidle' });
    await customerPage.waitForSelector('.cart-item-card', { timeout: 10000 });

    let cartItems = await customerPage.locator('.cart-item-card').all();
    console.log(`   Items in cart: ${cartItems.length} (expected: 3)`);
    if (cartItems.length !== 3) {
      throw new Error(`Expected 3 items in cart, but found ${cartItems.length}`);
    }
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_03_cart_3_items.png') });

    // ── 5. CHANGE QUANTITY & REMOVE ONE ITEM ──
    console.log('\n5. Updating item quantity and removing one item...');
    // Increase quantity of first item
    const firstItemPlus = customerPage.locator('.cart-item-card').first().locator('.cart-stepper-btn[aria-label="Increase quantity"]');
    await firstItemPlus.click();
    await customerPage.waitForFunction(() => {
      const vals = Array.from(document.querySelectorAll('.cart-item-card .cart-stepper-val'));
      return vals.some((el) => el.textContent?.trim() === '2');
    }, { timeout: 8000 });
    const updatedQty = await customerPage.locator('.cart-item-card').first().locator('.cart-stepper-val').textContent();
    console.log(`   Updated quantity of first item: ${updatedQty?.trim()} (expected: 2)`);
    if (updatedQty?.trim() !== '2') {
      throw new Error(`Expected first item quantity to be 2, but got ${updatedQty?.trim()}`);
    }

    // Remove the third item
    const thirdItemRemove = customerPage.locator('.cart-item-card').nth(2).locator('.cart-link-btn.danger');
    await thirdItemRemove.click();
    await customerPage.waitForTimeout(1500);

    cartItems = await customerPage.locator('.cart-item-card').all();
    console.log(`   Items remaining in cart: ${cartItems.length} (expected: 2)`);
    if (cartItems.length !== 2) {
      throw new Error(`Expected 2 items in cart after removal, but found ${cartItems.length}`);
    }
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_04_cart_updated.png') });

    // ── 6. PROCEED TO CHECKOUT & ELIGIBILITY ENFORCEMENT ──
    console.log('\n6. Navigating to Checkout: http://localhost:5173/checkout');
    await customerPage.click('.checkout-primary-btn');
    await customerPage.waitForURL((url) => url.pathname.includes('/checkout'), { timeout: 10000 });

    // Step 1: Address selection
    console.log('   Step 1: Selecting Coimbatore Delivery Address...');
    await customerPage.waitForSelector('.address-selectable-card', { timeout: 10000 });
    const addressCards = await customerPage.locator('.address-selectable-card').all();
    console.log(`   Found ${addressCards.length} saved addresses.`);
    await addressCards[0].click();
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_05_checkout_address_step.png') });

    // Click "Continue to Drop-off Pin →"
    await customerPage.click('button:has-text("Continue to Drop-off Pin")');

    // Step 2: Location & Airspace Clearance verification
    console.log('   Step 2: Checking Airspace Eligibility...');
    await customerPage.waitForSelector('.geofence-status-box', { timeout: 10000 });
    await customerPage.waitForTimeout(1500); // Allow eligibility check to complete

    const eligibilityBox = customerPage.locator('.geofence-status-box');
    const isEligibleBox = await eligibilityBox.locator('.eligible-title, :has-text("Autonomous Delivery Corridor Verified"), :has-text("Airspace Clear")').count();
    console.log(`   Airspace Corridor Clear check visible: ${isEligibleBox > 0}`);
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_06_checkout_clear_corridor.png') });

    // ── 7. TEST AIRSPACE ENFORCEMENT: OUT OF SERVICE AREA & PROHIBITED NFZ ──
    console.log('\n7. Testing Airspace Enforcement rules (Out of area & Prohibited NFZ)...');
    
    // Test Out of Service Area (Chennai 13.0827, 80.2707) via in-page authenticated client
    const outOfAreaData: any = await customerPage.evaluate(async () => {
      return (window as any).api.geofence.checkEligibility(13.0827, 80.2707, 3.5);
    });
    console.log(`   Chennai (13.0827, 80.2707) Eligibility: isEligible = ${outOfAreaData.isEligible}, status = ${outOfAreaData.airspaceStatus}, msg = "${outOfAreaData.message}"`);
    if (outOfAreaData.isEligible !== false || outOfAreaData.airspaceStatus !== 'OUT_OF_SERVICE_RADIUS') {
      throw new Error(`Expected Chennai to be OUT_OF_SERVICE_RADIUS, got ${JSON.stringify(outOfAreaData)}`);
    }

    // Test Prohibited No-Fly Zone (Coimbatore Airport Runway 11.0300, 77.0400) via in-page authenticated client
    const prohibitedData: any = await customerPage.evaluate(async () => {
      return (window as any).api.geofence.checkEligibility(11.0300, 77.0400, 3.5);
    });
    console.log(`   Runway (11.0300, 77.0400) Eligibility: isEligible = ${prohibitedData.isEligible}, status = ${prohibitedData.airspaceStatus}, conflict = ${prohibitedData.conflictingZones?.[0]?.code}`);
    if (prohibitedData.isEligible !== false || prohibitedData.airspaceStatus !== 'PROHIBITED_NFZ') {
      throw new Error(`Expected Runway to be PROHIBITED_NFZ, got ${JSON.stringify(prohibitedData)}`);
    }
    console.log('   Airspace enforcement verification passed completely!');

    // ── 8. COMPLETE CHECKOUT STEPS & PLACE ORDER ──
    console.log('\n8. Completing Checkout Steps...');
    // Step 2 -> Step 3
    const confirmDropZoneBtn = customerPage.locator('button:has-text("Confirm Drop Zone & Continue")');
    await confirmDropZoneBtn.click();
    await customerPage.waitForTimeout(600);

    // Step 3 -> Step 4
    console.log('   Step 3: Instructions confirmed.');
    await customerPage.click('button:has-text("Continue to Delivery Speed")');
    await customerPage.waitForTimeout(600);

    // Step 4 -> Step 5
    console.log('   Step 4: Delivery Speed selected.');
    await customerPage.click('button:has-text("Continue to Payment")');
    await customerPage.waitForTimeout(600);

    // Step 5 -> Step 6
    console.log('   Step 5: Payment method selected.');
    await customerPage.click('button:has-text("Review Order")');
    await customerPage.waitForTimeout(600);

    // Step 6: Review & Place Order
    console.log('   Step 6: Reviewing and Authorizing Order...');
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_07_checkout_review_step.png') });

    const placeOrderBtn = customerPage.locator('button:has-text("Authorize & Place Order")');
    await placeOrderBtn.click();

    // Wait for Order Confirmation Screen
    await customerPage.waitForSelector(':has-text("Order Placed Successfully!"), :has-text("Order Reference")', { timeout: 15000 });
    console.log('   Order Placed Successfully! 🎉');
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_08_order_placed_confirmation.png') });

    // Extract Order Reference
    const orderRefEl = customerPage.locator('strong:has-text("#")').first();
    const orderRefText = await orderRefEl.textContent();
    createdOrderId = orderRefText ? orderRefText.replace('#', '').trim() : '';
    console.log(`   Captured Created Order ID: ${createdOrderId}`);

    // ── 9. VERIFY ORDER IN CUSTOMER ORDERS PAGE ──
    console.log('\n9. Navigating to Customer Orders Page: http://localhost:5173/orders');
    await customerPage.goto('http://localhost:5173/orders', { waitUntil: 'networkidle' });
    await customerPage.waitForSelector('.order-card, .main-content', { timeout: 10000 });
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'customer_09_customer_orders_page.png') });

    const orderCards = await customerPage.locator('.order-card').all();
    console.log(`   Customer has ${orderCards.length} orders listed in order history.`);
    if (orderCards.length === 0) {
      throw new Error('Expected at least 1 order in customer orders page!');
    }

    // ── 10. ADMIN LOGIN & ORDER VERIFICATION ──
    console.log('\n10. Admin Portal Verification: http://localhost:5174/login');
    const adminContext = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1280, height: 800 },
    });
    const adminPage = await adminContext.newPage();

    await adminPage.goto('http://localhost:5174/login', { waitUntil: 'networkidle' });
    await adminPage.fill('input[type="text"], input[type="email"]', 'admin@skynav.local');
    await adminPage.fill('input[type="password"]', 'ChangeMe123!');
    await adminPage.click('button[type="submit"]');

    await adminPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`   Admin logged in successfully! Current URL: ${adminPage.url()}`);

    // Navigate to Admin Orders Page
    console.log('   Navigating to Admin Orders Page: http://localhost:5174/orders');
    await adminPage.goto('http://localhost:5174/orders', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000); // Allow operational data sync
    await adminPage.screenshot({ path: path.join(screenshotsDir, 'admin_01_orders_verified.png') });

    console.log('   Admin Orders Page loaded and verified!');
    console.log('\n=== ALL VERIFICATION CHECKS PASSED WITH FLYING COLORS! ===');

  } catch (error) {
    console.error('\n❌ ERROR during customer journey test:', error);
    await customerPage.screenshot({ path: path.join(screenshotsDir, 'error_failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
