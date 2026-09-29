import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function inspectCustomerTracking() {
  console.log('=== INSPECTING CUSTOMER TRACKING RUNTIME ===');

  // 1. Authenticate via customer API
  console.log('1. Authenticating customer via API...');
  const authRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@skynav', password: 'skynav@123' })
  });
  const authData = await authRes.json();
  if (!authData.token) {
    throw new Error(`Customer auth failed: ${JSON.stringify(authData)}`);
  }
  console.log('   Authenticated as:', authData.user?.name, authData.user?.email);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs: { type: string; text: string }[] = [];
  const networkRequests: { url: string; status: number; method: string }[] = [];
  const failedRequests: { url: string; errorText: string }[] = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`);
  });

  page.on('pageerror', err => {
    console.log('[PAGE ERROR]', err.message);
  });

  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), errorText: req.failure()?.errorText || 'unknown' });
    console.log('[FAILED REQUEST]', req.url(), req.failure()?.errorText);
  });

  page.on('response', res => {
    networkRequests.push({ url: res.url(), status: res.status(), method: res.request().method() });
    if (res.status() >= 400) {
      console.log(`[HTTP ${res.status()}]`, res.url());
    }
  });

  console.log('2. Setting up localStorage authentication...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((token, user) => {
    localStorage.setItem('drone_customer_token', JSON.stringify(token));
    localStorage.setItem('drone_customer_user', JSON.stringify(user));
    localStorage.setItem('skynav_customer_token', token);
    localStorage.setItem('skynav_customer_user', JSON.stringify(user));
  }, authData.token, authData.user);

  console.log('3. Navigating to /tracking/ORD-1002...');
  await page.goto('http://localhost:5173/tracking/ORD-1002', { waitUntil: 'networkidle2' });

  // Wait 4 seconds for map, tiles, and SSE to initialize
  await new Promise(r => setTimeout(r, 4000));

  // Capture screenshot of customer tracking page
  await page.screenshot({ path: 'scratch/customer_tracking_inspect.png', fullPage: true });
  console.log('   Saved screenshot to scratch/customer_tracking_inspect.png');

  // DOM and Window evaluation
  const evaluation = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const hasApiRequiredText = bodyText.toLowerCase().includes('api required') || bodyText.toLowerCase().includes('api key');
    const leafletContainer = document.querySelector('.leaflet-container');
    const mapWrapper = document.querySelector('.map-wrapper');
    const tileImages = Array.from(document.querySelectorAll('.leaflet-tile')).map((el: any) => ({
      src: el.src,
      complete: el.complete,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight
    }));
    const droneMarker = document.querySelector('.custom-drone-leaflet-icon');
    const destMarker = document.querySelector('.custom-dest-leaflet-icon');
    const hubMarker = document.querySelector('.custom-hub-leaflet-icon');

    return {
      title: document.title,
      hasApiRequiredText,
      hasMapWrapper: !!mapWrapper,
      hasLeafletContainer: !!leafletContainer,
      tileCount: tileImages.length,
      loadedTileCount: tileImages.filter(t => t.complete && t.naturalWidth > 0).length,
      tileImagesSample: tileImages.slice(0, 6),
      hasDroneMarker: !!droneMarker,
      hasDestMarker: !!destMarker,
      hasHubMarker: !!hubMarker,
      skynavDrone: (window as any).__skynavCustomerDrone || null,
      skynavMapCamera: (window as any).__skynavCustMapCamera || null,
      bodyTextSnippet: bodyText.slice(0, 400)
    };
  });

  console.log('\n=== RUNTIME EVALUATION RESULT ===');
  console.log('Page Title:', evaluation.title);
  console.log('Has "API required" on Page:', evaluation.hasApiRequiredText);
  console.log('Has Map Wrapper:', evaluation.hasMapWrapper);
  console.log('Has Leaflet Container:', evaluation.hasLeafletContainer);
  console.log('Total Tiles in DOM:', evaluation.tileCount);
  console.log('Successfully Loaded Tiles:', evaluation.loadedTileCount);
  console.log('Tile Sample:', JSON.stringify(evaluation.tileImagesSample, null, 2));
  console.log('Has Drone Marker:', evaluation.hasDroneMarker);
  console.log('Has Dest Marker:', evaluation.hasDestMarker);
  console.log('Has Hub Marker:', evaluation.hasHubMarker);
  console.log('window.__skynavCustomerDrone:', JSON.stringify(evaluation.skynavDrone, null, 2));
  console.log('window.__skynavCustMapCamera:', JSON.stringify(evaluation.skynavMapCamera, null, 2));

  const tileReqs = networkRequests.filter(r => r.url.includes('tile') || r.url.includes('arcgis') || r.url.includes('cartocdn') || r.url.includes('osm'));
  console.log(`\n=== TILE NETWORK REQUESTS (${tileReqs.length}) ===`);
  tileReqs.slice(0, 10).forEach(r => console.log(`${r.status} ${r.url}`));

  console.log(`\n=== FAILED REQUESTS (${failedRequests.length}) ===`);
  failedRequests.forEach(f => console.log(`${f.errorText}: ${f.url}`));

  // Check any console errors or warnings
  const errors = consoleLogs.filter(c => c.type === 'error' || c.text.toLowerCase().includes('error') || c.text.toLowerCase().includes('api'));
  console.log(`\n=== CONSOLE LOGS OF INTEREST (${errors.length}) ===`);
  errors.forEach(e => console.log(`[${e.type}] ${e.text}`));

  await browser.close();
}

inspectCustomerTracking().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
