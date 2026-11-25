/**
 * k6 load test — telemetry ingestion.
 *
 * Simulates a fleet of 40 drones (SkyHub Kurumbapalayam D-001..D-040) pushing
 * telemetry samples to `POST /api/v1/internal/telemetry` at 50 km/h cruise cadence (4000ms).
 *
 * Run:
 *   k6 run -e BASE_URL=http://localhost:4000 \
 *          -e API_KEY=local-dev-only-telemetry-key-change-me \
 *          -e DRONE_IDS=<uuid1>,<uuid2> \
 *          load-tests/telemetry-ingest.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const API_KEY = __ENV.API_KEY || 'local-dev-only-telemetry-key-change-me';
const DRONE_IDS = (__ENV.DRONE_IDS || 'd-001,d-002,d-003,d-004,d-005').split(',').filter((id) => id.length > 0);
const TICK_SECONDS = Number(__ENV.TICK_SECONDS || 4);

const ingestDuration = new Trend('telemetry_ingest_duration', true);

export const options = {
  scenarios: {
    fleet_telemetry: {
      executor: 'per-vu-iterations',
      vus: Math.min(DRONE_IDS.length, 40),
      iterations: Math.ceil(60 / TICK_SECONDS),
      maxDuration: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    telemetry_ingest_duration: ['p(95)<500'],
  },
};

export default function () {
  const droneId = DRONE_IDS[__VU - 1] || DRONE_IDS[0];
  const payload = JSON.stringify({
    droneId,
    lat: 11.1132 + (__ITER * 0.001),
    lng: 77.0277 + (__ITER * 0.001),
    altitudeMeters: 45.0,
    speedMps: 13.889, // 50 km/h
    headingDegrees: 180,
    batteryPercent: Math.max(20, 100 - __ITER),
    signalStrengthPercent: 95,
  });

  const res = http.post(`${BASE_URL}/api/v1/internal/telemetry`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
  });

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  ingestDuration.add(res.timings.duration);
  sleep(TICK_SECONDS);
}
