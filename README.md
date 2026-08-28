# SkyNav

SkyNav is a simulation-first, safety-aware platform for UAV last-mile delivery operations. It comprises exactly three connected experiences: Customer Portal, Admin Control Center, and Drone Simulation.

## Foundation architecture

This repository is a modular pnpm monorepo. The API owns transactional domain workflows; PostgreSQL/PostGIS stores tenant-owned records; Redis supports ephemeral state and fanout; the simulator and AI service remain isolated from flight control. AI output is advisory and must pass deterministic safety checks before a mission can be authorized.

The intended pipeline is `Plan → Validate → Score → Safety Check → Authorize → Execute`.

## Layout

- `apps/web` — Next.js shell for customer, admin, and tracking experiences.
- `apps/api` — modular Fastify API foundation.
- `services/ai` — Python advisory prediction interfaces.
- `services/simulator` — digital-twin service boundary; no hardware control.
- `services/telemetry-worker` — validated, normalized telemetry ingestion boundary.
- `services/notification-worker` — notification delivery adapter boundary.
- `packages/contracts` — shared runtime-safe TypeScript schemas.
- `db/migrations` — PostgreSQL/PostGIS schema migrations.
- `edge` — future edge, MAVLink, and local-safety adapters.

## Local setup

Requirements: Node.js 22+, pnpm 11+, Docker Compose, and Python 3.11+ for AI development.

```bash
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`docker compose` starts only PostgreSQL/PostGIS and Redis. Database migration execution is intentionally deferred until the production database adapter is chosen; the initial SQL is available at `db/migrations/0001_foundation.sql`.

## Development commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Required reading

Read [ARCHITECTURE.md](ARCHITECTURE.md), [PROJECT_STATE.md](PROJECT_STATE.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md) before changing code. The team ownership guide is [SkyNav_TEAM_EXECUTION_GUIDE.md](SkyNav_TEAM_EXECUTION_GUIDE.md).

## Safety and security

Do not trust browser-provided tenant or role values. Every tenant-owned resource must be authorized and scoped server-side. Do not place raw high-frequency telemetry on broad browser fanout. Do not use simulated or AI results to bypass geofences, payload limits, battery reserve, weather restrictions, operator authorization, or emergency procedures.
