# SkyNav — Changelog & Migration Record

All notable changes and architectural upgrades across the migration from legacy intern architecture to the production-grade NestJS monorepo are documented here.

---

## Phase Summary & Progress Record

### Phase 7: Documentation, Verification & Handoff (Current)
- **Commit**: `docs(phase-7): finalize project documentation, architecture diagrams, security report, setup guide, and changelog`
- **Scope**:
  - Rewrote root `README.md` with complete architecture diagram, feature list, and quickstart instructions.
  - Rewrote `PROJECT_STATE.md` with verified checklist, test matrix, and zero unticked false claims.
  - Authored comprehensive `ARCHITECTURE.md` with Mermaid sequence and flowchart diagrams.
  - Authored detailed `SECURITY.md` recording all 20 fixed vulnerabilities and remaining production notes.
  - Authored cross-platform developer `SETUP.md` for Windows and Linux.
  - Authored complete `CHANGELOG.md` detailing migration history.
  - Audited all tracked files to verify zero real-looking secrets or credentials exist.

### Phase 6: DevOps, Testing & CI Hardening
- **Commit**: `1fa21a5`
- **Scope**:
  - Authored multi-stage production Dockerfiles:
    - `apps/api/Dockerfile`: Multi-stage Node 22 slim, non-root user `node`, Prisma client generation, compiled production NestJS build.
    - `apps/customer-web/Dockerfile`: Multi-stage build to lightweight Alpine Nginx with SPA routing fallback.
    - `apps/admin-web/Dockerfile`: Multi-stage build to lightweight Alpine Nginx with SPA routing fallback.
  - Created `docker-compose.prod.yml`: PostgreSQL 16 + PostGIS, Redis 7 (password-authenticated), MinIO, API, Customer Web, Admin Web. Enforced mandatory environment variable interpolation (`${VAR:?error}`) with **zero default passwords**.
  - Created GitHub Actions CI pipeline (`.github/workflows/ci.yml`):
    - Monorepo lint and TypeScript typecheck.
    - Unit test suite (61 suites, 430 tests).
    - Database migration and integration test run against live PostgreSQL/PostGIS, Redis, and MinIO service containers.
    - Strict dependency security audit: `pnpm audit --audit-level=high --prod` configured to fail CI builds on high severity.
    - Secret scanning via Gitleaks.
    - Playwright E2E journey execution.
  - Authored Playwright E2E test suites (`e2e/customer/customer-journey.spec.ts`, `e2e/admin/admin-journey.spec.ts`).
  - Authored k6 load tests for telemetry ingestion (40 drones, 4s interval) and Socket.IO realtime fan-out (`load-tests/`).
  - Authored free-first cloud deployment infrastructure specs (`render.yaml`, `apps/*/vercel.json`, `docs/DEPLOYMENT.md`).

### Phase 5: Advanced Simulation Intelligence
- **Commit**: `a44047e`
- **Scope**:
  - Built Computer Vision frame analysis and landing zone evaluation console (`apps/admin-web/src/pages/Intelligence/IntelligencePage.tsx`).
  - Built Autonomous Swarm load balancing & dynamic partitioning console (`apps/admin-web/src/pages/Swarm/SwarmPage.tsx`).
  - Built Digital Twin offline what-if simulation sandbox (`apps/admin-web/src/pages/DigitalTwin/DigitalTwinPage.tsx`), strictly isolated from live flight operations.
  - Integrated administrative analytics dashboard (`apps/admin-web/src/pages/Business/AnalyticsPage.tsx`) with real KPI metrics and live aggregations.
  - Updated Admin Console navigation sidebar and router with simulation badges.

### Phase 4: Frontend Integration & Session Isolation
- **Commit**: `5c93fcd`
- **Scope**:
  - Connected Customer Web (React 19 + Vite) to unified API via `@skynav/api-client`.
  - Connected Admin Console (React 18 + Vite) to unified API via `@skynav/api-client`.
  - Enforced in-memory JWT access token management across both client applications.
  - Implemented true cross-tab session isolation with separate cookie names and paths:
    - Customer: `skynav_customer_refresh_token`
    - Admin: `skynav_admin_refresh_token`
  - Created and verified session isolation integration test (`session-isolation.integration.spec.ts`).
  - Rewrote and executed `test_full_workflow.ts` against unified NestJS API on port 4000 (all 16 steps passed).
  - Decommissioned and completely removed legacy Express backends (`legacy/customer-backend`, `legacy/admin-backend`).

### Phase 3: Backend Migration to NestJS & PostGIS
- **Commit**: `5801a95`
- **Scope**:
  - Implemented NestJS 11 modular monolith with 18 bounded domain modules.
  - Integrated Prisma ORM with PostgreSQL 16 and PostGIS spatial extensions.
  - Implemented Argon2id password hashing, 15-minute access JWTs, and rotating refresh tokens with reuse detection.
  - Implemented Redis-backed account lockout (10 attempts / 15m) and `POST /auth/logout-all`.
  - Implemented server-side RBAC permission matrix enforced via `@RequirePermission()` and `PermissionsGuard`.
  - Implemented product catalog, inventory movements, cart, wishlist, checkout, and simulated payment provider.
  - Implemented delivery state machine with SHA-256 hashed OTP and QR verification.
  - Configured Coimbatore hub: **SkyHub Kurumbapalayam Base (`11.1132°N, 77.0277°E`)**.
  - Seeded 40 autonomous UAVs (`D-001` through `D-040`) stationed at Kurumbapalayam hub.
  - Seeded Indian product catalog (Electronics, Medical, Groceries, Cloud Kitchen, Industrial Spare Parts).
  - Seeded Coimbatore DGCA no-fly zones (Sulur Air Force Station, Airport, Prison, INS Agrani, Western Ghats Reserve).
  - Ported corridor route planner and kinematics engine (50 km/h cruise, 45 m altitude).
  - Connected Gazebo telemetry bridge (port 8085) with `x-service-key` HMAC authentication.
  - Enforced authoritative safety pipeline: `Plan → Validate → Score → Safety Check → Authorize → Execute`.

### Phase 2: Monorepo & Tooling Restructuring
- **Commit**: `ec490ce`
- **Scope**:
  - Restructured repository into pnpm workspace managed by Turborepo.
  - Organized directory structure: `apps/api`, `apps/customer-web`, `apps/admin-web`, `packages/shared-types`, `packages/api-client`, `packages/config`, `services/drone-simulator`, `infra/`, and `simulation/gazebo/`.
  - Configured strict TypeScript compiler configuration (`tsconfig.base.json`).
  - Added ESLint and Prettier formatting across the monorepo.
  - Added development `docker-compose.yml` (PostgreSQL + PostGIS, Redis, MinIO, Mailhog).

### Phase 1: Security Hardening on Legacy Backends
- **Commit**: `d35afbb`
- **Scope**:
  - Added `requireAdmin` middleware to all `/api/admin/*` routes and admin WebSocket connections.
  - Removed hardcoded fallback secrets; added fail-fast startup checks.
  - Eliminated `force` flag and `D-001` bypass in dispatch pipeline.
  - Added strict CORS allow-list, `helmet` security headers, and rate limiting.
  - Replaced `Math.random()` with `crypto.randomInt()` for OTP, PIN, and password resets.
  - Rotated legacy default password `skynav@123`.

### Phase 0: Safety Net & Contract Baseline
- **Commit**: `cefce3c`
- **Tag**: `v0-demo`
- **Scope**:
  - Tagged baseline state as `v0-demo`.
  - Executed baseline workflow test (`test_full_workflow.ts`).
  - Mapped all 54 customer and admin API endpoints in `docs/api-contract-map.md`.
