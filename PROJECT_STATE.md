# SkyNav Project State

## Current milestone

Milestone 2D — Telemetry Transport + Realtime Live Bridge (**COMPLETED**)

## Foundation status

- **Backend & Identity Foundation**: Argon2id password security, JWT refresh token rotation, RBAC, tenant isolation, and transactional audit logging completed.
- **Simulator Foundation**: Deterministic 3D kinematic engine, state machine validator, battery failsafes, RTH without teleportation, and multi-drone fleet manager completed.
- **Frontend & Design System Foundation**: Aviation operations design system (`@skynav/ui`), liquid glass & dark operational theme, application shells (Customer & Admin), tactical radar map abstraction, and Next.js 15 pages implemented.
- **Orders Domain & API Foundation**: Centralized strict order state machine, WGS84 geographic location validation, package specifications, multi-tenant database scoping, customer ownership enforcement, RBAC hooks, and RFC 7807 Problem Details error envelopes implemented.
- **Fleet Inventory & Mission Dispatch Foundation**: Centralized UAV operational state machine, fleet inventory management, mission planning state machine, atomic transactional drone-to-mission assignment with race condition protection, and decoupled simulator gateway adapter implemented.
- **Realtime Telemetry & WebSocket Gateway**: High-throughput tenant-isolated Redis Pub/Sub transport, TelemetryWorker with schema validation and out-of-order frame tracking, authenticated Fastify WebSocket gateway (`/api/v1/ws/telemetry`), backpressure management, and Next.js realtime tactical radar hook completed and verified.

> **SAFETY NOTICE**: This is a deterministic software simulator and operational platform designed for development, testing, and operator training; it is NOT real flight-control software and does not interface with physical flight hardware (PX4, ArduPilot, MAVLink).

## Completed

### 1. Milestone 1A: Database + Identity Foundation
- **Centralized Environment Configuration**: Schema validation via Zod in `@skynav/config` supporting `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `NODE_ENV`, `API_PORT`, `API_HOST`, `API_CORS_ORIGIN`, and `.env.example`.
- **Database & Kysely Integration**: Typed Kysely database access with `pg.Pool` connection pooling, health checks, and lifecycle management in `apps/api/src/infrastructure/db/`.
- **Transactional Migration Runner**: Deterministic migration tracking (`_schema_migrations`) in `db/scripts/migrate.mjs` applying `0001_foundation.sql`, `0002_identity_and_audit.sql`, `0003_orders.sql`, and `0004_fleet_and_missions.sql` safely within transactions.
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

### 3. Milestone 2A: Frontend Application Shell + Design System
- **Aviation Design Tokens & Theme Engine** (`packages/ui/src/tokens/`, `apps/web/src/app/globals.css`):
  - High-density dark operational aesthetic with full support for light mode and `prefers-reduced-motion`.
  - Coherent tokens for semantic colors, elevation, aviation cyan/blue accents, radius, and typography.
  - Liquid glass and glassmorphism styling utilities (`.glass-panel`, `.glass-card`, `.hud-panel`).
- **Design System Primitives** (`packages/ui/src/primitives/`):
  - `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Badge`, `StatusBadge`, `Card`, `GlassPanel`, `Modal`, `Dropdown`, `Tooltip`, `Tabs`, `Table`, `Pagination`, `Alert`, `Skeleton`, `Spinner`, `EmptyState`, `ErrorState`, `Breadcrumb`, `Avatar`.
  - Comprehensive SVG icon set (`DroneIcon`, `RadarIcon`, `BatteryIcon`, `PackageIcon`, `RouteIcon`, `ShieldIcon`, `CompassIcon`, `WarehouseIcon`, `SlidersIcon`, etc.).
- **Domain & Operational Components** (`packages/ui/src/domain/`):
  - `StatCard`, `DroneCard`, `MissionCard`, `OrderCard`, `BatteryIndicator`, `ConnectionStatus`, `SystemHealthGrid`, `AlertCard`, `ActivityTimeline`, `TelemetrySummary`.
- **Tactical Map Abstraction** (`packages/ui/src/map/`):
  - `MapView` container with `MapProviderAdapter` interface.
  - Native `SvgRadarMap` provider rendering concentric radar rings, crosshairs, drone markers with heading indicators, flight routes with waypoint nodes, and geofence danger zones.
- **Application Shells** (`apps/web/src/components/shell/`):
  - Responsive `AppShell` with persistent sidebar, mobile drawer, UTC tactical clock, quick search, notification dropdown, and profile selector.
  - `CustomerNav` and `AdminNav` modules.
- **Customer Experience Portal** (`apps/web/src/app/customer/`):
  - `/customer`, `/customer/orders`, `/customer/orders/[id]`, `/customer/tracking`, `/customer/notifications`, `/customer/profile`.
- **Admin Mission Control Center** (`apps/web/src/app/admin/`):
  - `/admin`, `/admin/orders`, `/admin/fleet`, `/admin/missions`, `/admin/tracking`, `/admin/alerts`, `/admin/audit`, `/admin/settings`.
- **Isolated Typed Demo Data** (`apps/web/src/lib/demo-data.ts`):
  - Centralized typed datasets for drones, orders, missions, alerts, audit logs, and geofences.

### 4. Milestone 2B: Order Domain + Order API Foundation
- **Centralized Strict Order State Machine** (`apps/api/src/modules/orders/order.state-machine.ts`):
  - Legal transitions: `CREATED -> CONFIRMED -> ASSIGNED -> IN_TRANSIT -> DELIVERED`.
  - Cancellation allowed from `CREATED`, `CONFIRMED`, and `ASSIGNED`; terminal states (`DELIVERED`, `CANCELLED`, `FAILED`) reject further transitions.
- **Multi-Tenant Security & Customer Ownership Rules**:
  - `organizationId` and `customerId` derived from authenticated server-side JWT session context.
  - Customers restricted to viewing and managing only their own orders (`customer_id = user.id`).
- **Fastify Order Endpoints** (`apps/api/src/modules/orders/order.routes.ts`):
  - `POST /api/v1/orders`, `GET /api/v1/orders`, `GET /api/v1/orders/:orderId`, `PATCH /api/v1/orders/:orderId/status`, `POST /api/v1/orders/:orderId/cancel`.

### 5. Milestone 2C: Fleet Inventory + Mission Dispatch Foundation
- **Centralized UAV Operational State Machine** (`apps/api/src/modules/fleet/drone.state-machine.ts`):
  - Drone operational status model: `IDLE`, `AVAILABLE`, `ASSIGNED`, `TAKEOFF`, `EN_ROUTE`, `ARRIVED`, `DELIVERING`, `RETURNING`, `LANDED`, `MAINTENANCE`, `EMERGENCY`, `OFFLINE`.
- **Fleet Inventory & Multi-Tenant Scoping** (`apps/api/src/modules/fleet/`):
  - Server-side tenant isolation: Every drone query scoped by `organization_id`.
  - Unique call sign constraint per organization (`idx_drones_org_call_sign`).
  - Endpoints: `POST /api/v1/drones`, `GET /api/v1/drones`, `GET /api/v1/drones/:droneId`, `PATCH /api/v1/drones/:droneId`.
- **Mission Lifecycle & State Machine** (`apps/api/src/modules/missions/mission.state-machine.ts`):
  - Delivery mission progression: `PENDING -> ASSIGNED -> LAUNCHING -> IN_PROGRESS -> DELIVERING -> RETURNING -> COMPLETED`.
  - Partial unique index preventing duplicate active missions for the same order (`idx_missions_order_active`).
- **Atomic Transactional Drone Assignment** (`apps/api/src/modules/missions/mission.repository.ts`):
  - Row-level lock (`forUpdate()`) on mission, drone, and order tables within a single database transaction.

### 6. Milestone 2D: Telemetry Transport + Realtime Live Bridge
- **Redis Pub/Sub Transport Topology** (`services/telemetry-worker/src/publisher.ts`):
  - Tenant-isolated channel naming: `telemetry:org:${organizationId}` (organization stream) and `telemetry:drone:${organizationId}:${droneId}` (targeted UAV stream).
  - Pipelined JSON serialization and error-isolated publishing without blocking simulation physics.
- **Decoupled Simulator Bridge Boundary** (`services/telemetry-worker/src/tests/simulator-bridge.test.ts`):
  - Bridges `FleetSimulator.onTelemetry` to `TelemetryPublisher` asynchronously without mutating simulator clock progression or requiring Redis in unit tests.
- **Telemetry Worker** (`services/telemetry-worker/src/worker.ts`):
  - Automatic reconnects with exponential backoff and pattern subscription (`telemetry:org:*`, `telemetry:drone:*`).
  - Strict schema validation with Zod (`parseTelemetry`) and out-of-order / stale timestamp tracking per drone.
  - Operational metrics tracking (`messagesReceived`, `messagesValid`, `messagesInvalid`, `messagesOutOfOrder`).
- **Fastify WebSocket Gateway** (`apps/api/src/modules/realtime/`):
  - Endpoint: `GET /api/v1/ws/telemetry`.
  - Authenticated via JWT token query param, Authorization Bearer header, or `AUTH` message handshake with a 10-second unauthenticated disconnect timer.
  - Granular RBAC and Tenant Isolation:
    - `ADMIN`, `OPERATOR`, `FLEET_MANAGER`, `DISPATCHER`: Can subscribe to entire organization stream `telemetry:organization` or specific drones.
    - `CUSTOMER`: Prohibited from organization-wide streams (`INSUFFICIENT_PERMISSIONS`); restricted strictly to drones associated with their own active orders.
    - Cross-tenant subscription attempts are rejected immediately (`CROSS_TENANT_SUBSCRIPTION_DENIED`).
  - Bounded client backpressure queue (drops older intermediate frames when socket buffer exceeds 64KB).
  - Heartbeat `PING` / `PONG` support and clean subscription teardown on socket disconnect.
- **Frontend Realtime Hook** (`apps/web/src/lib/realtime.ts`):
  - `useRealtimeTelemetry` hook providing automatic connection, channel subscription, reconnects, and live marker updates for `admin/tracking` and `customer/tracking`.
- **Automated Test Coverage**:
  - 114 total automated tests across all monorepo packages (69 API tests, 21 simulator tests, 8 telemetry worker tests, 13 contracts tests, 3 web tests).

## Remaining

- **Milestone 3: Geospatial Safety & Operational Hardening**:
  - PostGIS geofence polygon management & real-time intersection alerts
  - Weather snapshot risk scoring & automatic hold/reroute rules
  - Operator intervention suite (Manual Return-To-Home, Emergency Abort)
- **Milestone 4: Advisory AI & Predictive Routing**
- **Milestone 5: Advanced Simulation & Edge Integration**

## Recommended next step

Implement Milestone 3: Geospatial Safety & Operational Hardening (PostGIS geofence polygon boundary checks, spatial containment queries, weather risk scoring, and operator intervention controls).

## Important decisions

- **Tenant-Scoped Redis Channel Architecture**: Redis channels incorporate `organizationId` directly in the channel key (`telemetry:org:{orgId}`, `telemetry:drone:{orgId}:{droneId}`), guaranteeing that cross-tenant message leakage is impossible at the transport tier.
- **Pure Simulator Boundary**: Simulator core remains 100% deterministic and free of Redis/Fastify/network dependencies. The bridge consumes simulator events via standard callbacks.
- **Server-Side Authorization on Subscriptions**: WebSocket subscription requests are verified against server-side session JWT claims and database ownership records, preventing unauthorized client-side claims.
- **Bounded Backpressure & Stale Frame Dropping**: High-frequency telemetry streams prioritize freshness over historical buffering; if a client buffer backs up or an older packet arrives late, it is dropped in favor of current state.
- **Aviation HUD Aesthetic**: High-density operational interface using liquid glass surfaces and restrained micro-interactions.
- **Vendor-Agnostic Map Abstraction**: `MapView` supports pluggable map adapters (SVG Radar Map for lightweight zero-dependency rendering, ready for MapLibre/Mapbox).
- **PostgreSQL/PostGIS + Kysely**: Typed relational & spatial database queries.
- **Token Rotation & Reuse Detection**: Refresh tokens are single-use; reuse triggers instant revocation of all active sessions.
- **AI is Advisory**: Route scores and ETAs are recommendations; safety policy and human operator sign-off remain authoritative.
