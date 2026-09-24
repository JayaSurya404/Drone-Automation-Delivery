import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = 'C:/Users/chitr/.gemini/antigravity-ide/brain/e53c8981-c701-473a-a8b1-9312a5e9cdd8/evidence';

async function testCartCheckout() {
  console.log('Fetching customer auth token from backend...');
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@skynav', password: 'skynav@123' }),
  });
  const data = await res.json();
  console.log('Login response:', data.user?.name, 'Token:', !!data.token);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // Go to root first to establish domain
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

  // Inject auth
  await page.evaluate((auth) => {
    localStorage.setItem('drone_customer_token', auth.token);
    localStorage.setItem('drone_customer_user', JSON.stringify(auth.user));
  }, data);

  // Navigate to Checkout
  console.log('Navigating to Customer Checkout (http://localhost:5173/checkout)...');
  await page.goto('http://localhost:5173/checkout', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  // Helper to click button by text content
  async function clickButtonWithText(text: string) {
    await page.evaluate((btnText) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.textContent?.includes(btnText));
      if (btn) btn.click();
      else console.error('Button not found:', btnText);
    }, text);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Step 1 -> Step 2
  console.log('Step 1: Selecting address and continuing...');
  await clickButtonWithText('Continue to Drop-off Pin');

  // Step 2 -> Step 3
  console.log('Step 2: Confirming drop zone...');
  await clickButtonWithText('Confirm Drop Zone');

  // Step 3 -> Step 4
  console.log('Step 3: Confirming instructions...');
  await clickButtonWithText('Continue to Delivery Speed');

  // Step 4 -> Step 5
  console.log('Step 4: Confirming speed...');
  await clickButtonWithText('Continue to Payment');

  // Step 5 -> Step 6
  console.log('Step 5: Confirming payment method...');
  await clickButtonWithText('Review Order');

  console.log('Step 6 reached: Taking Review Screenshot...');
  await new Promise((r) => setTimeout(r, 1500));

  // Wait for images
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
  console.log('Saved Step 6 Review:', shot4Path);

  await browser.close();
  console.log('Done!');
}

testCartCheckout().catch(console.error);
