# Production Deployment & Infrastructure Guide

Comprehensive operational guide for deploying, configuring, and maintaining the SkyNav Autonomous UAV Last-Mile Delivery & Fleet Intelligence platform.

---

## 1. System Deployment Architecture

The SkyNav platform is designed as a modular, containerized multi-service digital twin system:

```
                          ┌───────────────────────────┐
                          │   Next.js 15 Web Cockpit  │ (Port 3000)
                          └─────────────┬─────────────┘
                                        │
                                        ▼ (REST & WSS)
                          ┌───────────────────────────┐
                          │     Fastify Domain API    │ (Port 3001)
                          └──────┬──────┬──────┬──────┘
                                 │      │      │
             ┌───────────────────┘      │      └──────────────────┐
             ▼                          ▼                         ▼
  ┌───────────────────────┐  ┌────────────────────┐  ┌────────────────────────┐
  │ PostgreSQL + PostGIS  │  │   Redis 7 Alpine   │  │ Python Advisory AI / CV│ (Port 8000)
  │ (Durable Domain State)│  │ (Telemetry & Bus)  │  │ (Pure Standard Lib)    │
  └──────────┬────────────┘  └──────────┬─────────┘  └────────────────────────┘
             │                          │
             │             ┌────────────┴────────────┐
             │             ▼                         ▼
             │      ┌───────────────┐         ┌─────────────────────┐
             │      │  Telemetry    │         │ Notification Outbox │
             │      │  Worker       │         │ Worker              │
             │      └───────────────┘         └─────────────────────┘
             │                                           ▲
             └───────────────────────────────────────────┘
```

### Core Service Components

| Service | Technology | Port | Purpose | State Model |
| :--- | :--- | :--- | :--- | :--- |
| **`web`** | Next.js 15 / React 19 | `3000` | Operations cockpit & customer tracking | Ephemeral UI |
| **`api`** | Fastify / Kysely / TypeScript | `3001` | Domain REST, RBAC, WebSocket gateway | Authoritative API |
| **`ai`** | Python 3.11 Standard Lib | `8000` | Advisory route scoring, ETA, Vision | Advisory / Stateless |
| **`telemetry-worker`**| Node.js 22 / TypeScript | — | High-throughput telemetry validation | Stream processor |
| **`notification-worker`**| Node.js 22 / TypeScript | — | Transactional outbox event processor | Idempotent worker |
| **`postgres`** | PostGIS 16-3.4 | `5432` | Relational domain models & spatial data | Durable Authoritative |
| **`redis`** | Redis 7 Alpine | `6379` | Realtime Pub/Sub & telemetry broker | In-memory transport |

---

## 2. Container Architecture & Security

Each service runs in a hardened, containerized environment:

1. **Non-Root Execution**:
   - Node.js containers (`api`, `web`, `telemetry-worker`, `notification-worker`) execute under unprivileged user `skynav` (`uid: 1001`) or `nextjs` (`uid: 1001`).
   - Python AI service executes under unprivileged user `skynav` (`uid: 1001`).
2. **Minimal Base Images**:
   - `node:22-alpine` and `python:3.11-alpine` are used to minimize image surface area.
3. **Multi-Stage Builds**:
   - Development dependencies, compilers, and lockfile parsers are discarded in builder stages.
4. **Graceful Signal Handling**:
   - All services catch `SIGTERM` and `SIGINT` to cleanly close open HTTP listeners, WebSocket connections, database connection pools, and Redis subscriptions.

---

## 3. Environment Variables & Secret Configuration

### Environment Variable Matrix

| Variable | Description | Default (Development) | Production Requirement |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Target environment | `development` | Must be `production` |
| `API_PORT` | Fastify listening port | `3001` | Set to `3001` or platform port |
| `API_HOST` | Fastify bind address | `0.0.0.0` | `0.0.0.0` |
| `API_CORS_ORIGIN` | Allowed web CORS origin | `http://localhost:3000` | Strict domain (e.g. `https://app.skynav.io`), no `*` |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://skynav:...` | Production RDS / managed PostGIS cluster URI |
| `REDIS_URL` | Redis connection URI | `redis://localhost:6379` | Production Redis cluster URI (`rediss://...`) |
| `JWT_SECRET` | 256-bit token signing secret | Development 32-char key | $\ge 32$ random chars (rejects default in prod) |
| `JWT_ACCESS_TTL` | Access token lifespan | `15m` | `15m` |
| `JWT_REFRESH_TTL` | Refresh token lifespan | `7d` | `7d` |
| `AI_SERVICE_URL` | AI microservice endpoint | `http://localhost:8000` | Internal VPC endpoint (`http://ai:8000`) |
| `NEXT_PUBLIC_WS_URL` | Browser WebSocket URL | `ws://localhost:3001/...` | `wss://api.skynav.io/api/v1/ws/telemetry` |
| `NEXT_PUBLIC_MAP_PROVIDER` | Map cartography provider | `osm` | `osm` / `maplibre` / `custom` |

---

## 4. Operational Health & Readiness Probes

### Endpoints Reference

- **`GET http://localhost:3001/health`** (Liveness Probe):
  - Fast, non-blocking check verifying process responsiveness.
  - Returns `200 OK` with `status: "LIVE"` and uptime.
- **`GET http://localhost:3001/ready`** (Readiness Probe):
  - Deep dependency check verifying PostgreSQL connectivity and Redis connection.
  - Returns `200 OK` when ready; returns `503 Service Unavailable` if critical dependencies are down.
- **`GET http://localhost:3001/metrics`** (Observability Metrics):
  - In-memory metrics snapshot covering request counts, errors, auth failures, WebSocket states, and memory heap statistics.
- **`GET http://localhost:8000/health`** (AI Liveness Probe):
  - Returns `200 OK` with `status: "ok"`, `service: "skynav-ai"`.

---

## 5. Local One-Command Startup

### Prerequisites
- Node.js $\ge 22.0.0$
- pnpm $\ge 11.9.0$
- Python $\ge 3.11$
- Docker & Docker Compose (optional for containerized deployment)

### Method A: Native Local Monorepo Startup
```bash
# 1. Install workspace dependencies
pnpm install

# 2. Setup environment variables
cp .env.example .env

# 3. Start PostgreSQL and Redis backing services
docker compose up -d postgres redis

# 4. Run database migrations
pnpm db:migrate

# 5. Optionally seed development test accounts
pnpm db:seed

# 6. Start all applications & workers in parallel
pnpm dev
```

### Method B: Complete Containerized Stack Startup
```bash
# 1. Verify Docker Compose configuration
docker compose config

# 2. Build and start all 7 containers in background
docker compose up -d

# 3. Run database migrations inside API or host
pnpm db:migrate

# 4. Inspect container health
docker compose ps

# 5. View live logs
docker compose logs -f api web ai telemetry-worker notification-worker

# 6. Stop stack safely
docker compose down
```

---

## 6. Accessing the Platform

- **Admin & Fleet Cockpit**: `http://localhost:3000/admin`
- **Customer Tracking Portal**: `http://localhost:3000/customer`
- **REST API Endpoints**: `http://localhost:3001/api/v1/modules`
- **API Health & Readiness**: `http://localhost:3001/health` and `http://localhost:3001/ready`
- **Advisory AI Microservice**: `http://localhost:8000/health`
