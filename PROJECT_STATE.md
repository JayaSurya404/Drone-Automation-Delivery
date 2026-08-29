# SkyNav Project State

## Current milestone

Milestone 2B — Order Domain + Order API Foundation (**COMPLETED**)

## Foundation status

- **Backend & Identity Foundation**: Argon2id password security, JWT refresh token rotation, RBAC, tenant isolation, and transactional audit logging completed.
- **Simulator Foundation**: Deterministic 3D kinematic engine, state machine validator, battery failsafes, RTH without teleportation, and multi-drone fleet manager completed.
- **Frontend & Design System Foundation**: Aviation operations design system (`@skynav/ui`), liquid glass & dark operational theme, application shells (Customer & Admin), tactical radar map abstraction, and Next.js 15 pages implemented and verified with automated test suites.
- **Orders Domain & API Foundation**: Centralized strict order state machine, WGS84 geographic location validation, package specifications, multi-tenant database scoping, customer ownership enforcement, RBAC hooks, and RFC 7807 Problem Details error envelopes implemented and verified with 37 API tests.

> **SAFETY NOTICE**: This is a deterministic software simulator and operational platform designed for development, testing, and operator training; it is NOT real flight-control software and does not interface with physical flight hardware (PX4, ArduPilot, MAVLink).

## Completed

### 1. Milestone 1A: Database + Identity Foundation
- **Centralized Environment Configuration**: Schema validation via Zod in `@skynav/config` supporting `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `NODE_ENV`, `API_PORT`, `API_HOST`, `API_CORS_ORIGIN`, and `.env.example`.
- **Database & Kysely Integration**: Typed Kysely database access with `pg.Pool` connection pooling, health checks, and lifecycle management in `apps/api/src/infrastructure/db/`.
- **Transactional Migration Runner**: Deterministic migration tracking (`_schema_migrations`) in `db/scripts/migrate.mjs` applying `0001_foundation.sql`, `0002_identity_and_audit.sql`, and `0003_orders.sql` safely within transactions.
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
  - Centralized legal state transitions: `CREATED -> CONFIRMED -> ASSIGNED -> IN_TRANSIT -> DELIVERED`.
  - Cancellation allowed from `CREATED`, `CONFIRMED`, and `ASSIGNED`; terminal states (`DELIVERED`, `CANCELLED`, `FAILED`) reject further transitions.
  - Strict rule validator `validateOrderStateTransition` throwing `InvalidOrderStateTransitionError` (RFC 7807 422 Unprocessable Entity).
- **Location Model & Geographic Validation**:
  - Validates WGS84 coordinates (latitude $[-90, 90]$, longitude $[-180, 180]$, optional altitude AGL in meters).
  - Validates package parameters (weight $> 0$ and $\le 50\text{kg}$, optional 3D bounding dimensions $L \times W \times H$).
- **Multi-Tenant Security & Customer Ownership Rules**:
  - `organizationId` and `customerId` are always derived from authenticated server-side JWT session context.
  - Repository queries scope all queries by `organization_id`.
  - Customers are restricted to viewing and managing only their own orders (`customer_id = user.id`); cross-customer and cross-tenant access returns 403/404.
  - Customers are strictly prohibited from manually updating operational flight statuses (requires `orders:update` permission).
  - Customers can only cancel their own orders in pre-dispatch states (`CREATED`, `CONFIRMED`).
- **Transactional Database Model & Migrations** (`db/migrations/0003_orders.sql`, `apps/api/src/infrastructure/db/schema.ts`):
  - Extended `orders` table with `order_number` (unique tracking ID), `customer_id`, `priority`, pickup/delivery coordinates and addresses, package dimensions/weight, timestamps (`confirmed_at`, `assigned_at`, `delivered_at`, `cancelled_at`, `failed_at`), cancellation reasons, and audit actors.
  - Performance indexes on `(organization_id, created_at DESC)`, `(customer_id, created_at DESC)`, and `(organization_id, status)`.
- **Fastify Order Endpoints** (`apps/api/src/modules/orders/order.routes.ts`):
  - `POST /api/v1/orders`: Create new delivery order with server-assigned order number.
  - `GET /api/v1/orders`: Paginated list filtered by status/priority and scoped by organization and customer ownership.
  - `GET /api/v1/orders/:orderId`: Retrieve single order by ID with ownership enforcement.
  - `PATCH /api/v1/orders/:orderId/status`: Operator/dispatcher flight status update with state machine validation.
  - `POST /api/v1/orders/:orderId/cancel`: Order cancellation with role-specific cancellation rules.
- **Audit Logging Integration**:
  - Emits structured audit events (`ORDER_CREATED`, `ORDER_STATUS_UPDATED`, `ORDER_CANCELLED`) with metadata (order number, weight, previous status, reason, actor).
- **Automated Test Coverage**:
  - 37 automated tests across `apps/api/src/modules/` verifying order state transitions, repository operations, customer ownership rules, cross-tenant isolation, IDOR prevention, RBAC permissions, and RFC 7807 error responses.
  - Total monorepo tests: 73/73 passing.

## Remaining

- **Milestone 2C: Mission Dispatch Engine & Telemetry Gateway**:
  - Automated drone assignment (`apps/api/src/modules/fleet`)
  - Mission planning, validation & authorization state machine (`apps/api/src/modules/missions`)
  - Telemetry streaming adapter connecting Simulator -> Redis -> WebSockets
  - Live API integration connecting frontend services to Fastify backend
  - Proof-of-delivery verification (OTP/QR handshake)
- **Milestone 3: Geospatial Safety & Operational Hardening**:
  - PostGIS geofence polygon management & real-time intersection alerts
  - Weather snapshot risk scoring & automatic hold/reroute rules
  - Operator intervention suite (Manual Return-To-Home, Emergency Abort)
- **Milestone 4: Advisory AI & Predictive Routing**
- **Milestone 5: Advanced Simulation & Edge Integration**

## Recommended next step

Implement Milestone 2C: Drone Fleet Inventory & Assignment, Mission Planning & Authorization Engine, and Telemetry Bridge connecting the Simulator to Redis and live WebSocket transport.

## Important decisions

- **Server-Side Identity Authority**: `organization_id` and `customer_id` are derived strictly from verified JWT claims; client payload claims are ignored to eliminate IDOR and tenant spoofing.
- **Strict State Machine**: Centralized state transition validator prevents out-of-order execution (e.g. `DELIVERED -> CREATED`).
- **Customer vs Operator Separation**: Customers can only create and cancel pre-dispatch orders; dispatchers and operators control the flight dispatch lifecycle.
- **Aviation HUD Aesthetic**: High-density operational interface using liquid glass surfaces and restrained micro-interactions.
- **Vendor-Agnostic Map Abstraction**: `MapView` supports pluggable map adapters (SVG Radar Map for lightweight zero-dependency rendering, ready for MapLibre/Mapbox).
- **Simulation-first**: Digital-twin architecture isolated from flight hardware.
- **Deterministic Math**: Pure clock ticks (`tick(deltaSeconds)`) without wall-clock dependency in the core physics model.
- **PostgreSQL/PostGIS + Kysely**: Typed relational & spatial database queries.
- **Token Rotation & Reuse Detection**: Refresh tokens are single-use; reuse triggers instant revocation of all active sessions.
- **AI is Advisory**: Route scores and ETAs are recommendations; safety policy and human operator sign-off remain authoritative.
