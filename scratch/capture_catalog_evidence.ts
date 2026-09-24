import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = 'C:/Users/chitr/.gemini/antigravity-ide/brain/e53c8981-c701-473a-a8b1-9312a5e9cdd8/evidence';

async function run() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  console.log('Launching Headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // 1. Log in via UI
  console.log('Logging in to Customer Portal via UI...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  
  // Fill inputs
  const emailInput = await page.$('input[type="email"], input[placeholder*="email" i], input[name="email"]');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type('customer@skynav');
  }

  const passInput = await page.$('input[type="password"]');
  if (passInput) {
    await passInput.click({ clickCount: 3 });
    await passInput.type('skynav@123');
  }

  // Click Submit
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, 1000));
  console.log('Logged in successfully. Current URL:', page.url());

  // SCREENSHOT 1: Customer Catalog Grid
  console.log('1. Navigating to Customer Products page...');
  await page.goto('http://localhost:5173/products', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.ecom-product-card', { timeout: 10000 });
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            })
        )
    );
  });
  await new Promise((r) => setTimeout(r, 1000));
  const shot1Path = path.join(EVIDENCE_DIR, '01_customer_catalog_grid.png');
  await page.screenshot({ path: shot1Path, fullPage: false });
  console.log('Saved:', shot1Path);

  // SCREENSHOT 2: Customer Product Details (Masala Dosa)
  console.log('2. Navigating to Product Details (Masala Dosa prod_food_2)...');
  await page.goto('http://localhost:5173/products/prod_food_2', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.product-details-main-grid', { timeout: 10000 });
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            })
        )
    );
  });
  await new Promise((r) => setTimeout(r, 1000));
  const shot2Path = path.join(EVIDENCE_DIR, '02_customer_product_details.png');
  await page.screenshot({ path: shot2Path, fullPage: false });
  console.log('Saved:', shot2Path);

  // Add Masala Dosa to Basket
  console.log('Adding Masala Dosa to Cart...');
  const addBtn = await page.$('button.ecom-btn-primary, button:has-text("Add to Basket")');
  // Evaluate click on add button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.includes('Add to Basket'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Also add Filter Coffee
  console.log('Navigating to Filter Coffee (prod_groc_1) and adding to Cart...');
  await page.goto('http://localhost:5173/products/prod_groc_1', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.includes('Add to Basket'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // SCREENSHOT 3: Customer Cart Page
  console.log('3. Navigating to /cart...');
  await page.goto('http://localhost:5173/cart', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            })
        )
    );
  });
  const shot3Path = path.join(EVIDENCE_DIR, '03_customer_cart_view.png');
  await page.screenshot({ path: shot3Path, fullPage: false });
  console.log('Saved:', shot3Path);

  // SCREENSHOT 4: Customer Checkout Review
  console.log('4. Navigating to Customer Checkout...');
  await page.goto('http://localhost:5173/checkout', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            })
        )
    );
  });
  const shot4Path = path.join(EVIDENCE_DIR, '04_customer_checkout_review.png');
  await page.screenshot({ path: shot4Path, fullPage: false });
  console.log('Saved:', shot4Path);

  await browser.close();
  console.log('✅ Updated Cart & Checkout screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
