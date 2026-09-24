import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EVIDENCE_DIR = 'C:\\Users\\chitr\\.gemini\\antigravity-ide\\brain\\e53c8981-c701-473a-a8b1-9312a5e9cdd8\\evidence';

async function testSignup() {
  const profileDir = path.join(process.cwd(), 'scratch', `chrome_profile_${Date.now()}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: profileDir,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Navigating to http://localhost:5173/register...');
  await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle2' });

  console.log('Filling form with reliable input setter...');
  const newEmail = `aero_${Date.now()}@skynav.io`;
  await page.evaluate(`
    (function(email) {
      var inputs = document.querySelectorAll('input');
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var ph = inp.getAttribute('placeholder') || '';
        var val = '';
        if (ph === 'John Doe') val = 'Vikram Rathore';
        else if (ph === 'customer@skynav') val = email;
        else if (ph === '+91 98422 00000') val = '+91 98422 99887';
        else if (ph === 'Min. 8 characters') val = 'SecureFlight@2026';
        else if (ph === 'Re-enter password') val = 'SecureFlight@2026';
        if (val) {
          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(inp, val);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    })('${newEmail}')
  `);

  console.log('Taking pre-submit screenshot...');
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_pin_signup_no_input.png') });

  console.log('Clicking submit via evaluate...');
  await page.evaluate(() => {
    const btn = document.getElementById('register-submit-btn');
    console.log('register-submit-btn found:', !!btn);
    if (btn) {
      btn.click();
    } else {
      const form = document.getElementById('customer-register-form') as HTMLFormElement;
      console.log('customer-register-form found:', !!form);
      form?.requestSubmit();
    }
  });

  console.log('Waiting for onboarding card...');
  await page.waitForSelector('#permanent-delivery-pin-display', { timeout: 10000 });
  const pin = await page.$eval('#permanent-delivery-pin-display', el => el.textContent?.trim());
  console.log('Captured generated PIN:', pin);

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_pin_signup_onboarding.png') });

  console.log('Clicking continue to dashboard...');
  await page.click('#continue-to-dashboard-btn');
  await new Promise(r => setTimeout(r, 1000));

  console.log('Navigating to profile...');
  await page.goto('http://localhost:5173/profile', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#profile-permanent-pin');
  await page.click('#toggle-profile-pin-btn');
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_profile_permanent_pin.png') });
  console.log('SUCCESS!');
  await browser.close();
}

testSignup().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
