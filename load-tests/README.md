# SkyNav Load Tests (k6)

Performance benchmarks for telemetry ingestion and real-time tracking WebSocket connections.

## Prerequisites

1. Install [k6](https://k6.io/docs/get-started/installation/):
   ```bash
   winget install k6 --source winget
   ```
2. SkyNav NestJS API running on `http://localhost:4000`.
3. Database seeded (`pnpm db:seed`).

## 1. Telemetry Ingest Benchmark

Simulates up to 40 autonomous drones concurrently streaming 50 km/h kinematic GPS points:

```bash
k6 run -e BASE_URL=http://localhost:4000 \
       -e API_KEY=local-dev-only-telemetry-key-change-me \
       -e DRONE_IDS=D-001,D-002,D-003,D-004,D-005 \
       load-tests/telemetry-ingest.js
```

Target SLA:
- p95 Ingest Latency < 500 ms
- HTTP Failure Rate < 1%

## 2. Real-Time Tracking WebSocket Benchmark

Simulates concurrent customer tracking sessions over Socket.IO:

```bash
k6 run -e BASE_URL=http://localhost:4000 \
       -e WS_URL=ws://localhost:4000 \
       -e CUSTOMER_EMAIL=customer@skynav.local \
       -e CUSTOMER_PASSWORD=ChangeMe123! \
       load-tests/realtime-tracking.js
```

Target SLA:
- p95 Connection Latency < 1000 ms
