import { spawn } from 'child_process';
import * as path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\chitr\\.gemini\\antigravity-ide\\brain\\7eb30bb3-94cd-49a5-bc00-ed5724e46082';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome_cust_test_profile');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9224',
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--disable-gpu',
    ],
    { stdio: 'ignore' }
  );

  await delay(1500);
  const versionRes = await fetch('http://127.0.0.1:9224/json/version').then((r) => r.json());
  const ws = new WebSocket(versionRes.webSocketDebuggerUrl);
  await new Promise<void>((res) => (ws.onopen = () => res()));

  let id = 1;
  const send = (method: string, params: any = {}, sessionId?: string): Promise<any> => {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (event: any) => {
        const msg = JSON.parse(event.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      const payload: any = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });
  };

  // Login customer
  const custLogin = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@skynav', password: 'skynav@123' }),
  }).then((r) => r.json());

  // Get an existing customer order
  const orders = await fetch('http://127.0.0.1:5000/api/orders', {
    headers: { Authorization: `Bearer ${custLogin.token}` },
  }).then((r) => r.json());
  const orderId = orders[0]?.id;
  console.log('Testing with Order ID:', orderId);

  const target = await send('Target.createTarget', { url: 'about:blank' });
  const session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
  await send('Page.enable', {}, session);
  await send('Runtime.enable', {}, session);

  await send('Page.navigate', { url: 'http://localhost:5173' }, session);
  await delay(800);

  // Set tokens
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('drone_customer_token', JSON.stringify('${custLogin.token}'));
      localStorage.setItem('drone_customer_user', JSON.stringify(${JSON.stringify(custLogin.user)}));
    `,
  }, session);

  await delay(300);
  await send('Page.navigate', { url: `http://localhost:5173/tracking/${orderId}` }, session);
  await delay(3000);

  const curUrl = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true }, session);
  console.log('Current URL in Customer Tab:', curUrl.result?.value);

  const custHook = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__skynavCustDrone || null)', returnByValue: true }, session);
  console.log('Customer Drone Hook:', custHook.result?.value);

  const bodyText = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0, 300)', returnByValue: true }, session);
  console.log('Body text:', bodyText.result?.value);

  ws.close();
  chromeProc.kill('SIGKILL');
}

main().catch(console.error);
