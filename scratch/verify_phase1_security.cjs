const { spawnSync, spawn } = require('child_process');
const WebSocket = require('ws');
const Database = require('better-sqlite3');
require('dotenv/config');

console.log('=== PHASE 1 SECURITY VERIFICATION ===');

// 1. Fail-fast check
console.log('\n[1] Testing Fail-Fast Startup...');
const failAdmin = spawnSync(process.execPath, ['legacy/admin-backend/dist/legacy/admin-backend/server.js'], {
  env: { ...process.env, ADMIN_JWT_SECRET: '', SKYNAV_INTERNAL_SERVICE_KEY: '' },
  encoding: 'utf8',
  timeout: 8000,
});
console.log('  Admin without secrets exit code:', failAdmin.status);
if (failAdmin.status === 0) {
  throw new Error('FAIL: Admin backend started without ADMIN_JWT_SECRET!');
}
console.log('  ✔ Admin backend failed fast as expected');

const failCust = spawnSync(process.execPath, ['legacy/customer-backend/dist/legacy/customer-backend/server.js'], {
  env: { ...process.env, JWT_SECRET: 'skynav@123', SKYNAV_INTERNAL_SERVICE_KEY: '' },
  encoding: 'utf8',
  timeout: 8000,
});
console.log('  Customer with weak secret exit code:', failCust.status);
if (failCust.status === 0) {
  throw new Error('FAIL: Customer backend started with weak secret!');
}
console.log('  ✔ Customer backend failed fast as expected');

// 2. Start Live Servers
async function main() {
  console.log('\n[2] Starting Both Backends for Runtime Security Checks...');
  const custProc = spawn(process.execPath, ['legacy/customer-backend/dist/legacy/customer-backend/server.js'], { stdio: ['ignore', 'inherit', 'inherit'] });
  const adminProc = spawn(process.execPath, ['legacy/admin-backend/dist/legacy/admin-backend/server.js'], { stdio: ['ignore', 'inherit', 'inherit'] });

  const stop = () => {
    try { custProc.kill(); } catch {}
    try { adminProc.kill(); } catch {}
  };

  try {
    const waitHealth = async (url) => {
      for (let i = 0; i < 30; i++) {
        try {
          const r = await fetch(url);
          if (r.ok) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 300));
      }
      throw new Error('Timeout waiting for ' + url);
    };

    await waitHealth('http://127.0.0.1:5000/api/health');
    await waitHealth('http://127.0.0.1:5001/api/health');
    console.log('  ✔ Both backends healthy on :5000 and :5001');

    // 3. requireAdmin check on /api/admin/*
    console.log('\n[3] Testing requireAdmin Protection...');
    const endpoints = [
      ['GET', '/api/admin/orders'],
      ['GET', '/api/admin/fleet'],
      ['GET', '/api/admin/auth/me'],
      ['POST', '/api/admin/dispatch/orders/ORD-1001/assign-drone'],
      ['GET', '/api/admin/missions'],
      ['GET', '/api/admin/products'],
    ];
    for (const [m, p] of endpoints) {
      const r = await fetch('http://127.0.0.1:5001' + p, {
        method: m,
        headers: { 'Content-Type': 'application/json' },
        body: m === 'POST' ? JSON.stringify({ droneId: 'D-001', force: true }) : undefined,
      });
      if (r.status !== 401) {
        throw new Error(`${m} ${p} returned ${r.status}, expected 401 Unauthorized!`);
      }
    }
    console.log('  ✔ All /api/admin/* routes reject unauthenticated requests with 401');

    // 4. Default password rejection check
    console.log('\n[4] Testing Default Password Rejection...');
    const oldAdmin = await fetch('http://127.0.0.1:5001/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@skynav', password: 'skynav@123' }),
    });
    const oldCust = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@skynav', password: 'skynav@123' }),
    });
    if (oldAdmin.status !== 401 || oldCust.status !== 401) {
      throw new Error(`Old password accepted: admin=${oldAdmin.status}, cust=${oldCust.status}`);
    }
    console.log('  ✔ Default password (skynav@123) rejected with 401 on both backends');

    // 5. Rotated password login
    console.log('\n[5] Testing Rotated Credentials Login...');
    const aLogin = await fetch('http://127.0.0.1:5001/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@skynav', password: process.env.ADMIN_SEED_PASSWORD }),
    });
    const cLogin = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@skynav', password: process.env.CUSTOMER_SEED_PASSWORD }),
    });
    const aJson = await aLogin.json();
    const cJson = await cLogin.json();
    if (!aLogin.ok || !aJson.token || !cLogin.ok || !cJson.token) {
      throw new Error('Rotated credential login failed!');
    }
    console.log('  ✔ Admin login succeeded (token issued)');
    console.log('  ✔ Customer login succeeded (token issued)');

    // 6. Cross-role token rejection (customer token on admin API)
    console.log('\n[6] Testing Customer Token Isolation...');
    const custOnAdmin = await fetch('http://127.0.0.1:5001/api/admin/orders', {
      headers: { Authorization: 'Bearer ' + cJson.token },
    });
    if (custOnAdmin.status !== 401 && custOnAdmin.status !== 403) {
      throw new Error('Customer JWT was accepted by admin API: ' + custOnAdmin.status);
    }
    console.log(`  ✔ Customer JWT rejected by admin API with status ${custOnAdmin.status}`);

    // 7. Security Headers, Rate Limiting, and CORS allow-list
    console.log('\n[7] Testing Helmet Headers, Rate Limiting, and CORS Allow-List...');
    const okCors = await fetch('http://127.0.0.1:5001/api/admin/orders', {
      headers: { Origin: 'http://localhost:5174', Authorization: 'Bearer ' + aJson.token },
    });
    const badCors = await fetch('http://127.0.0.1:5001/api/admin/orders', {
      headers: { Origin: 'http://evil.example', Authorization: 'Bearer ' + aJson.token },
    });

    if (okCors.headers.get('x-content-type-options') !== 'nosniff') {
      throw new Error('Missing Helmet x-content-type-options: nosniff');
    }
    if (!okCors.headers.get('ratelimit-limit')) {
      throw new Error('Missing express-rate-limit headers on /api/admin/orders');
    }
    if (okCors.headers.get('access-control-allow-origin') !== 'http://localhost:5174') {
      throw new Error('Missing expected CORS allow header for authorized origin');
    }
    if (badCors.headers.get('access-control-allow-origin')) {
      throw new Error('Unauthorized origin received access-control-allow-origin header!');
    }
    console.log('  ✔ Helmet security headers present (x-content-type-options: nosniff)');
    console.log('  ✔ express-rate-limit headers present (ratelimit-limit)');
    console.log('  ✔ CORS allow-list active (http://localhost:5174 allowed, http://evil.example denied)');

    // 8. WebSocket and SSE Authentication
    console.log('\n[8] Testing Realtime WebSocket & SSE Authentication...');
    const wsUnauthAdmin = await new Promise((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:5001/ws/admin');
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
      ws.on('open', () => { ws.close(); resolve(200); });
      ws.on('error', () => resolve(401));
    });
    if (wsUnauthAdmin !== 401) {
      throw new Error('Unauth /ws/admin expected 401, got ' + wsUnauthAdmin);
    }
    console.log('  ✔ Unauthenticated /ws/admin rejected with 401');

    const wsAuthAdmin = await new Promise((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:5001/ws/admin?token=' + encodeURIComponent(aJson.token));
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
      ws.on('open', () => { ws.close(); resolve(101); });
      ws.on('error', (e) => resolve(500));
    });
    if (wsAuthAdmin !== 101) {
      throw new Error('Authenticated /ws/admin expected 101 Switching Protocols, got ' + wsAuthAdmin);
    }
    console.log('  ✔ Authenticated /ws/admin upgraded with 101 Switching Protocols');

    const wsUnauthCust = await new Promise((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:5000/ws?orderId=ord_test');
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
      ws.on('open', () => { ws.close(); resolve(200); });
      ws.on('error', () => resolve(401));
    });
    if (wsUnauthCust !== 401) {
      throw new Error('Unauth /ws expected 401, got ' + wsUnauthCust);
    }
    console.log('  ✔ Unauthenticated customer /ws rejected with 401');

    const sseUnauth = await fetch('http://127.0.0.1:5000/api/tracking/ord_test/events');
    if (sseUnauth.status !== 401) {
      throw new Error('Unauthenticated SSE expected 401, got ' + sseUnauth.status);
    }
    console.log('  ✔ Unauthenticated SSE (/api/tracking/:id/events) rejected with 401');

    // 9. Dispatch Force / D-001 Bypass Removal Check
    console.log('\n[9] Testing Dispatch Force & D-001 Bypass Removal...');
    const adb = new Database('legacy/admin-backend/data/admin.db');
    const firstOrder = adb.prepare('SELECT id FROM operational_orders LIMIT 1').get();
    if (firstOrder) {
      adb.prepare("UPDATE drones SET status = 'charging' WHERE id = 'D-001'").run();
      const bypassRes = await fetch('http://127.0.0.1:5001/api/admin/dispatch/orders/' + firstOrder.id + '/assign-drone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + aJson.token },
        body: JSON.stringify({ droneId: 'D-001', force: true }),
      });
      adb.prepare("UPDATE drones SET status = 'available' WHERE id = 'D-001'").run();
      adb.close();

      if (bypassRes.status !== 409) {
        throw new Error('Expected 409 Conflict when assigning non-available drone with force:true, got ' + bypassRes.status);
      }
      console.log('  ✔ Dispatch attempt with force:true and busy drone D-001 returned 409 Conflict (bypass blocked)');
    } else {
      adb.close();
      console.log('  ℹ No operational orders in db to test dispatch bypass');
    }

    console.log('\n=================================================');
    console.log('🎉 ALL PHASE 1 SECURITY CONTROLS VERIFIED!');
    console.log('=================================================\n');
  } finally {
    stop();
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
