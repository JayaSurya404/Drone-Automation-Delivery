# SkyNav Project State

## Current milestone

Milestone 1A — Database + Identity Foundation (**COMPLETED**)

## Foundation status

Milestone 1A database, identity, authentication, RBAC, tenant isolation, and audit logging foundations implemented and fully verified with automated test suites.

## Completed

### Milestone 1A: Database + Identity Foundation
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
- **Automated Test Suites**: 25 automated unit and integration tests across `@skynav/config`, `@skynav/contracts`, and `@skynav/api` verifying password hashing, login/registration, token rotation, RBAC, and tenant isolation boundaries.

## Remaining

- **Milestone 2: Order-to-Simulated-Delivery Vertical Slice**:
  - Customer order creation & automated drone assignment
  - Mission planning, validation & authorization state machine
  - Kinematic drone simulation engine & telemetry streaming (WebSocket/Redis)
  - MapLibre real-time radar & customer tracking UI
  - Proof-of-delivery verification (OTP/QR handshake)
- **Milestone 3: Geospatial Safety & Operational Hardening**:
  - PostGIS geofence polygon management & real-time intersection alerts
  - Weather snapshot risk scoring & automatic hold/reroute rules
  - Operator intervention suite (Manual Return-To-Home, Emergency Abort)
- **Milestone 4: Advisory AI & Predictive Routing**
- **Milestone 5: Advanced Simulation & Edge Integration**

## Recommended next step

Implement Milestone 2: Customer Order Management & Drone Fleet vertical slice (`apps/api/src/modules/orders`, `apps/api/src/modules/fleet`, and `apps/api/src/modules/missions`).

## Important decisions

- **Simulation-first**: Digital-twin architecture isolated from flight hardware.
- **PostgreSQL/PostGIS + Kysely**: Typed relational & spatial database queries.
- **Token Rotation & Reuse Detection**: Refresh tokens are single-use; reuse triggers instant revocation of all active sessions.
- **Server-Side Tenant Context**: `organization_id` is always derived from authenticated server context, never trusted from the client.
- **AI is Advisory**: Route scores and ETAs are recommendations; safety policy and human operator sign-off remain authoritative.
