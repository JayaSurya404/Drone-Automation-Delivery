/**
 * k6 load test — realtime tracking WebSocket connection path.
 * Exercises Socket.IO wire protocol connection and room subscription.
 *
 * Run:
 *   k6 run -e BASE_URL=http://localhost:4000 \
 *          -e WS_URL=ws://localhost:4000 \
 *          -e CUSTOMER_EMAIL=customer@skynav.local \
 *          -e CUSTOMER_PASSWORD=ChangeMe123! \
 *          load-tests/realtime-tracking.js
 */
import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:4000';
const CUSTOMER_EMAIL = __ENV.CUSTOMER_EMAIL || 'customer@skynav.local';
const CUSTOMER_PASSWORD = __ENV.CUSTOMER_PASSWORD || 'ChangeMe123!';
const CONNECTION_SECONDS = Number(__ENV.CONNECTION_SECONDS || 15);

const connectDuration = new Trend('ws_connect_duration', true);

export const options = {
  scenarios: {
    ws_connections: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  thresholds: {
    ws_connect_duration: ['p(95)<1000'],
  },
};

export default function () {
  // Login to retrieve customer access token
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD }),
    { headers: { 'Content-Type': 'application/json', 'x-client-app': 'customer' } }
  );

  const token = loginRes.json('data.accessToken') || '';
  if (!token) return;

  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket&token=${token}`;
  const start = Date.now();

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      connectDuration.add(Date.now() - start);
      socket.send('40/tracking,');
      socket.setTimeout(() => {
        socket.close();
      }, CONNECTION_SECONDS * 1000);
    });

    socket.on('error', (e) => {
      console.warn('WebSocket error:', e.error());
    });
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
