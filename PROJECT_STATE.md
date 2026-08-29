# SkyNav Project State

## Current milestone

Milestone 2C — Fleet Inventory + Mission Dispatch Foundation (**COMPLETED**)

## Foundation status

- **Backend & Identity Foundation**: Argon2id password security, JWT refresh token rotation, RBAC, tenant isolation, and transactional audit logging completed.
- **Simulator Foundation**: Deterministic 3D kinematic engine, state machine validator, battery failsafes, RTH without teleportation, and multi-drone fleet manager completed.
- **Frontend & Design System Foundation**: Aviation operations design system (`@skynav/ui`), liquid glass & dark operational theme, application shells (Customer & Admin), tactical radar map abstraction, and Next.js 15 pages implemented and verified with automated test suites.
- **Orders Domain & API Foundation**: Centralized strict order state machine, WGS84 geographic location validation, package specifications, multi-tenant database scoping, customer ownership enforcement, RBAC hooks, and RFC 7807 Problem Details error envelopes implemented.
- **Fleet Inventory & Mission Dispatch Foundation**: Centralized UAV operational state machine, fleet inventory management, mission planning state machine, atomic transactional drone-to-mission assignment with race condition protection, decoupled simulator gateway adapter, and comprehensive behavioral test suites (60 API tests, 99 total monorepo tests).

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
  - `Button` (primary, secondary, destructive, ghost, outline, glass variants with loading states).
  - `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Badge`.
  - `StatusBadge` specialized for Drone (`IDLE` to `OFFLINE`), Order (`DRAFT` to `CANCELLED`), and Mission (`PLANNED` to `ABORTED`) states.
  - `Card`, `GlassPanel`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
  - `Modal` (accessible dialog with focus management), `Dropdown`, `Tooltip`, `Tabs`, `Table`, `Pagination`.
  - `Alert`, `Skeleton`, `Spinner`, `EmptyState`, `ErrorState`, `Breadcrumb`, `Avatar`.
  - Comprehensive SVG icon set (`DroneIcon`, `RadarIcon`, `BatteryIcon`, `PackageIcon`, `RouteIcon`, `ShieldIcon`, `CompassIcon`, `WarehouseIcon`, `SlidersIcon`, etc.).
- **Domain & Operational Components** (`packages/ui/src/domain/`):
  - `StatCard`: KPI metric cards with delta percentages and trend coloring.
  - `DroneCard`: UAV cards with battery bar, altitude, ground speed, heading, and quick RTH/Abort buttons.
  - `MissionCard`: Flight mission summary with progress bar, waypoints count, and ETA.
  - `OrderCard`: Order summary cards with package details and recipient info.
  - `BatteryIndicator`: Color-coded battery gauge with voltage readout and charging states.
  - `ConnectionStatus`: Heartbeat indicator with latency display.
  - `SystemHealthGrid`: Real-time infrastructure status grid (API, Simulator, Telemetry, Database).
  - `AlertCard`: Incident alert cards with severity tagging (`CRITICAL`, `WARNING`, `INFO`).
  - `ActivityTimeline`: Chronological audit and flight event timeline.
  - `TelemetrySummary`: HUD gauges for airspeed, altitude AGL, heading azimuth, and GPS coordinates.
- **Tactical Map Abstraction** (`packages/ui/src/map/`):
  - `MapView` container with `MapProviderAdapter` interface.
  - Native `SvgRadarMap` provider rendering concentric radar rings, crosshairs, drone markers with heading indicators, flight routes with waypoint nodes, and geofence danger zones.
- **Application Shells** (`apps/web/src/components/shell/`):
  - Responsive `AppShell` with persistent sidebar, mobile drawer, UTC tactical clock, quick search, notification dropdown, and profile selector.
  - `CustomerNav` and `AdminNav` modules.
- **Customer Experience Portal** (`apps/web/src/app/customer/`):
  - `/customer`: Dashboard with active airborne delivery radar, verification OTP, and recent orders.
  - `/customer/orders`: Order history table with search and status filters.
  - `/customer/orders/[id]`: Detailed flight milestone timeline, assigned drone stats, and OTP code.
  - `/customer/tracking`: Full-screen live tracking tactical radar with telemetry HUD.
  - `/customer/notifications`: Filterable notification inbox.
  - `/customer/profile`: Verified rooftop landing zone coordinates and alert preferences.
- **Admin Mission Control Center** (`apps/web/src/app/admin/`):
  - `/admin`: Operations dashboard with KPI metrics, fleet radar overview, and subsystem health.
  - `/admin/orders`: Master orders table with dispatch triggers.
  - `/admin/fleet`: UAV fleet management grid & list with manual RTH and Emergency abort controls.
  - `/admin/missions`: Flight mission dispatch board with corridor risk scoring and weather checks.
  - `/admin/tracking`: Operations tactical radar with multi-drone selector and live telemetry gauges.
  - `/admin/alerts`: Incident response center with acknowledge/resolve workflows.
  - `/admin/audit`: Security audit log viewer with tenant isolation verification.
  - `/admin/settings`: Airspace limits, safety thresholds, and simulator speed multiplier controls.
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
  - State machine validator `validateDroneStateTransition(currentStatus, targetStatus)` preventing illegal jumps (e.g. `DELIVERING -> IDLE`).
- **Fleet Inventory & Multi-Tenant Scoping** (`apps/api/src/modules/fleet/`):
  - Server-side tenant isolation: Every drone query scoped by `organization_id`.
  - Unique call sign constraint per organization (`idx_drones_org_call_sign`).
  - Endpoints: `POST /api/v1/drones`, `GET /api/v1/drones`, `GET /api/v1/drones/:droneId`, `PATCH /api/v1/drones/:droneId`.
  - Strict RBAC: Customers receive `403 Forbidden` on fleet registration and command endpoints.
- **Mission Lifecycle & State Machine** (`apps/api/src/modules/missions/mission.state-machine.ts`):
  - Delivery mission progression: `PENDING -> ASSIGNED -> LAUNCHING -> IN_PROGRESS -> DELIVERING -> RETURNING -> COMPLETED`.
  - Terminal states (`COMPLETED`, `CANCELLED`, `FAILED`, `ABORTED`) reject further transitions.
  - Partial unique index preventing duplicate active missions for the same order (`idx_missions_order_active`).
- **Atomic Transactional Drone Assignment** (`apps/api/src/modules/missions/mission.repository.ts`):
  - Row-level lock (`forUpdate()`) on mission, drone, and order.
  - Atomically verifies availability, reserves drone (`ASSIGNED`), updates mission (`ASSIGNED`, `drone_id`), and updates order (`ASSIGNED`).
  - Prevents race conditions from concurrent operator assignment attempts.
- **Simulator Gateway Boundary** (`apps/api/src/modules/missions/simulator.adapter.ts`):
  - Decoupled `SimulatorGateway` interface isolating HTTP/Database layers from physical simulation internals.
- **Audit Trail Integration**:
  - Emits structured audit logs (`DRONE_REGISTERED`, `DRONE_UPDATED`, `DRONE_STATUS_UPDATED`, `MISSION_CREATED`, `MISSION_ASSIGNED`, `MISSION_STATUS_UPDATED`, `EMERGENCY_COMMAND_ISSUED`).
- **Automated Test Coverage**:
  - 60 automated tests in `apps/api/src/modules/` covering state transitions, tenant isolation, RBAC, duplicate prevention, and atomic assignment race condition protection.
  - Total monorepo tests: 99/99 passing.

## Remaining

- **Milestone 2D: Telemetry Transport & Real-time Live Bridge**:
  - Telemetry streaming adapter connecting Simulator -> Redis Pub/Sub -> Fastify WebSockets
  - Live API integration connecting frontend tracking components to Fastify backend
  - Proof-of-delivery verification (OTP/QR handshake)
- **Milestone 3: Geospatial Safety & Operational Hardening**:
  - PostGIS geofence polygon management & real-time intersection alerts
  - Weather snapshot risk scoring & automatic hold/reroute rules
  - Operator intervention suite (Manual Return-To-Home, Emergency Abort)
- **Milestone 4: Advisory AI & Predictive Routing**
- **Milestone 5: Advanced Simulation & Edge Integration**

## Recommended next step

Implement Milestone 2D: Telemetry Transport & Real-time Live Bridge connecting the Simulator to Redis Pub/Sub and live WebSocket streaming to the Web tactical radar.

## Important decisions

- **Decoupled Simulator Gateway**: The backend mission and fleet layers communicate through a `SimulatorGateway` interface, maintaining a clean boundary that does not leak simulation classes or physics calculations into API handlers.
- **Atomic Transactional Assignment**: Database transactions with row locks guarantee that conflicting concurrent drone assignments fail cleanly with `422/409` rather than corrupting state.
- **Server-Side Identity Authority**: `organization_id` and `customer_id` are derived strictly from verified JWT claims; client payload claims are ignored to eliminate IDOR and tenant spoofing.
- **Strict State Machines**: Centralized state transition validators for both Drones and Missions prevent out-of-order execution.
- **Aviation HUD Aesthetic**: High-density operational interface using liquid glass surfaces and restrained micro-interactions.
- **Vendor-Agnostic Map Abstraction**: `MapView` supports pluggable map adapters (SVG Radar Map for lightweight zero-dependency rendering, ready for MapLibre/Mapbox).
- **Simulation-first**: Digital-twin architecture isolated from flight hardware.
- **Deterministic Math**: Pure clock ticks (`tick(deltaSeconds)`) without wall-clock dependency in the core physics model.
- **PostgreSQL/PostGIS + Kysely**: Typed relational & spatial database queries.
- **Token Rotation & Reuse Detection**: Refresh tokens are single-use; reuse triggers instant revocation of all active sessions.
- **AI is Advisory**: Route scores and ETAs are recommendations; safety policy and human operator sign-off remain authoritative.
