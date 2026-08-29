# SkyNav Project State

## Current milestone

Milestone — Simulator Foundation (**COMPLETED**)

## Foundation status

Deterministic drone simulation engine, geospatial navigation math, state machine transitions, battery discharge model, deterministic return-to-home, emergency fail-safe handling, and multi-drone fleet simulator implemented and verified with automated test suites.

> **SAFETY NOTICE**: This is a deterministic software simulator designed for development, testing, and operator training; it is NOT real flight-control software and does not interface with physical flight hardware (PX4, ArduPilot, MAVLink).

## Completed

### 1. Milestone 1A: Database + Identity Foundation
- **Centralized Environment Configuration**: Schema validation via Zod in `@skynav/config` supporting `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `NODE_ENV`, `API_PORT`, `API_HOST`, `API_CORS_ORIGIN`, and `.env.example`.
- **Database & Kysely Integration**: Typed Kysely database access with `pg.Pool` connection pooling, health checks, and lifecycle management in `apps/api/src/infrastructure/db/`.
- **Transactional Migration Runner**: Deterministic migration tracking (`_schema_migrations`) in `db/scripts/migrate.mjs` applying `0001_foundation.sql` and `0002_identity_and_audit.sql` safely within transactions.
- **Idempotent Development Seeding**: Seed runner in `db/seeds/index.mjs` creating development organizations, Argon2id-hashed test accounts (Admin, Operator, Customer, Competitor Admin), and role memberships.
- **Argon2id Password Security & Cryptography**: Memory-hardened Argon2id hashing, secure token generation, and SHA-256 token indexing in `apps/api/src/modules/auth/crypto.ts`.
- **Authentication & Stateful Session Management**:
  - `POST /api/v1/auth/register`: User & organization creation with initial admin role.
  - `POST /api/v1/auth/login`: Credential verification with organization resolution.
  - `POST /api/v1/auth/refresh`: Refresh token rotation with reuse detection / session revocation.
  - `POST /api/v1/auth/logout`: Refresh token revocation and session clearance.
  - `GET /api/v1/auth/me`: Authenticated profile, active organization, and permissions.
- **RBAC & Permission Authorization**: Reusable authorization pre-handler hooks (`requireAuthenticated`, `requireRole`, `requirePermission`) with role-to-permission mapping (`ADMIN`, `OPERATOR`, `CUSTOMER`, `FLEET_MANAGER`, `DISPATCHER`).
- **Tenant Isolation**: Mandatory server-side tenant scoping (`requireTenantIsolation`), ensuring zero cross-tenant access to resources or audit records.
- **Structured Audit Logging**: Audit service and protected route (`GET /api/v1/audit-logs`) recording structured action events (`USER_REGISTERED`, `USER_LOGGED_IN`, `TOKEN_REFRESHED`, `ORGANIZATION_CREATED`, etc.).
- **Shared Domain Contracts**: Expanded `@skynav/contracts` with auth schemas, RBAC enums, and RFC 7807 Problem Details error models.

### 2. Milestone: Simulator Foundation
- **Deterministic Simulation Core** (`services/simulator/src/`):
  - Pure simulation clock progression (`tick(deltaSeconds)`), completely decoupled from wall-clock drift.
  - State machine validator (`assertValidStateTransition`) enforcing legal flight state transitions (`IDLE -> ASSIGNED -> TAKEOFF -> EN_ROUTE -> ARRIVED -> DELIVERING -> RETURNING -> LANDED`).
  - Emergency transitions supported from any in-flight state (`* -> EMERGENCY -> RETURNING -> LANDED`).
- **Geospatial & Kinematic Model** (`geo.ts`):
  - Spherical Earth Haversine distance, 3D Euclidean distance (with altitude delta), great-circle initial forward azimuth / bearing, and position projection calculations.
  - Kinematic simulation updating horizontal speed, climb rate, descent rate, and heading.
- **Automated Delivery Progression**:
  - Autonomous delivery sequence at target waypoint: `ARRIVED` -> `DELIVERING` (controlled descent to drop altitude -> verification hold timer -> climb back to cruise altitude) -> `RETURNING` (reverse waypoint navigation to home base) -> `LANDED`.
- **Battery Model & Safety Failsafes**:
  - Configurable state-dependent discharge rates (idle, cruise, climb, descent).
  - Low-battery advisory warning threshold ($25\%$).
  - Critical battery threshold ($15\%$) triggering automatic Return-To-Home fail-safe.
- **Deterministic Return-To-Home (RTH)**:
  - Navigates back along calculated trajectory to stored warehouse origin without teleportation.
- **Telemetry Frame Generation**:
  - Structured telemetry conforming to `@skynav/contracts` `Telemetry` schema plus extended simulation diagnostic metadata.
- **Multi-Drone Fleet Manager** (`fleet.ts`):
  - Manages concurrent independent drones (`SKY-001`, `SKY-002`, `SKY-003`, etc.).
  - Lockstep clock progression, pause, resume, reset, and fleet-wide telemetry/event aggregation.
  - Optional real-time timer loop wrapper for local demonstrations.
- **Automated Test Coverage**:
  - 21 automated unit and scenario tests in `services/simulator/src/tests/` verifying geospatial math, state machine transitions, waypoint navigation, battery discharge, delivery sequence, RTH, emergency triggers, and multi-drone fleet orchestration.

## Remaining

- **Milestone 2: Order-to-Simulated-Delivery Vertical Slice**:
  - Customer order creation & automated drone assignment (`apps/api/src/modules/orders`, `apps/api/src/modules/fleet`)
  - Mission planning, validation & authorization state machine (`apps/api/src/modules/missions`)
  - Telemetry streaming adapter connecting Simulator -> Redis -> WebSockets
  - MapLibre real-time radar & customer tracking UI
  - Proof-of-delivery verification (OTP/QR handshake)
- **Milestone 3: Geospatial Safety & Operational Hardening**:
  - PostGIS geofence polygon management & real-time intersection alerts
  - Weather snapshot risk scoring & automatic hold/reroute rules
  - Operator intervention suite (Manual Return-To-Home, Emergency Abort)
- **Milestone 4: Advisory AI & Predictive Routing**
- **Milestone 5: Advanced Simulation & Edge Integration**

## Recommended next step

Implement Milestone 2: Customer Order Management, Mission Engine, and Telemetry Bridge connecting the Simulator to the API and live WebSocket transport.

## Important decisions

- **Simulation-first**: Digital-twin architecture isolated from flight hardware.
- **Deterministic Math**: Pure clock ticks (`tick(deltaSeconds)`) without wall-clock dependency in the core physics model.
- **PostgreSQL/PostGIS + Kysely**: Typed relational & spatial database queries.
- **Token Rotation & Reuse Detection**: Refresh tokens are single-use; reuse triggers instant revocation of all active sessions.
- **Server-Side Tenant Context**: `organization_id` is always derived from authenticated server context, never trusted from the client.
- **AI is Advisory**: Route scores and ETAs are recommendations; safety policy and human operator sign-off remain authoritative.
