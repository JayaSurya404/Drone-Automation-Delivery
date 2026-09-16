import { spawn } from 'child_process';
import * as path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\chitr\\.gemini\\antigravity-ide\\brain\\7eb30bb3-94cd-49a5-bc00-ed5724e46082';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome_test_profile');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9223',
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--disable-gpu',
    ],
    { stdio: 'ignore' }
  );

  await delay(1500);
  const versionRes = await fetch('http://127.0.0.1:9223/json/version').then((r) => r.json());
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
      const payload: any = { id: msgId, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });
  };

  // 1. Admin login token
  const adminLogin = await fetch('http://127.0.0.1:5001/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skynav', password: 'skynav@123' }),
  }).then((r) => r.json());

  // Open Admin tab
  const target = await send('Target.createTarget', { url: 'about:blank' });
  const session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
  await send('Page.enable', {}, session);
  await send('Runtime.enable', {}, session);

  await send('Page.navigate', { url: 'http://localhost:5174' }, session);
  await delay(1000);
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('skynav_admin_token', '${adminLogin.token}');
      localStorage.setItem('skynav_auth_user', JSON.stringify(${JSON.stringify(adminLogin.user)}));
    `,
  }, session);

  await send('Page.navigate', { url: 'http://localhost:5174/operations' }, session);
  await delay(3000);

  const urlCheck = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true }, session);
  console.log('Admin Operations URL:', urlCheck.result?.value);

  const drone2D = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__skynav2DDrone || null)', returnByValue: true }, session);
  console.log('Admin 2D Drone Hook:', drone2D.result?.value);

  // Navigate to /simulation
  await send('Page.navigate', { url: 'http://localhost:5174/simulation' }, session);
  await delay(3000);

  const urlSim = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true }, session);
  console.log('Admin Simulation URL:', urlSim.result?.value);

  const drone3D = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__skynav3DDrone || null)', returnByValue: true }, session);
  console.log('Admin 3D Drone Hook:', drone3D.result?.value);

  ws.close();
  chromeProc.kill('SIGKILL');
}

main().catch(console.error);
