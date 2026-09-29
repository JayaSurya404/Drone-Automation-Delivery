import puppeteer from 'puppeteer-core';
import { generateHmacSignature } from '../shared/contracts/security.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testLiveUpdate() {
  console.log('1. Logging in customer...');
  const authRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@skynav', password: 'skynav@123' })
  });
  const authData = await authRes.json();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((token, user) => {
    localStorage.setItem('drone_customer_token', JSON.stringify(token));
    localStorage.setItem('drone_customer_user', JSON.stringify(user));
    localStorage.setItem('skynav_customer_token', token);
    localStorage.setItem('skynav_customer_user', JSON.stringify(user));
  }, authData.token, authData.user);

  console.log('2. Navigating to /tracking/ORD-1002...');
  await page.goto('http://localhost:5173/tracking/ORD-1002', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const initial = await page.evaluate(() => (window as any).__skynavCustomerDrone);
  console.log('Initial __skynavCustomerDrone:', initial);

  console.log('3. Sending test telemetry update from backend...');
  const testLat = 11.1085;
  const testLng = 77.0280;
  const event = {
    eventType: 'TELEMETRY_UPDATE',
    eventId: `evt_test_${Date.now()}`,
    timestamp: new Date().toISOString(),
    data: {
      customerOrderId: 'ORD-1002',
      missionId: 'MS-TEST',
      droneId: 'D-001',
      droneName: 'SkyNav Alpha-01',
      status: 'Out for Delivery',
      currentLocation: { latitude: testLat, longitude: testLng, altitudeMeters: 40, speedKmh: 40, bearing: 185 },
      remainingDistanceKm: 0.5,
      estimatedArrivalMins: 2,
      progressPercent: 50,
      timestamp: new Date().toISOString(),
      sampleId: 999999,
      simTime: 123.45
    }
  };
  const timestamp = new Date().toISOString();
  const signature = generateHmacSignature(event, 'skynav_secure_internal_service_key_2026', timestamp);

  const postRes = await fetch('http://localhost:5000/api/internal/telemetry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SkyNav-Timestamp': timestamp,
      'X-SkyNav-Signature': signature,
      'X-SkyNav-Event-Type': 'TELEMETRY_UPDATE',
      'X-SkyNav-Idempotency-Key': `evt_test_${Date.now()}`
    },
    body: JSON.stringify(event)
  });
  console.log('POST status:', postRes.status);

  // Wait 1.5 seconds for SSE/WebSocket delivery to browser
  await new Promise(r => setTimeout(r, 1500));

  const after = await page.evaluate(() => (window as any).__skynavCustomerDrone);
  console.log('After __skynavCustomerDrone:', after);

  await browser.close();
}

testLiveUpdate().catch(console.error);
