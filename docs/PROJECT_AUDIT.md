# SkyNav Platform Architecture & Technical Audit

**Audit Date:** August 28, 2026  
**Auditor:** Platform Engineering Lead  
**Repository Branch:** `develop`  
**Working Tree Status:** Clean  

---

## 1. Current Architecture

SkyNav is structured as a simulation-first, safety-aware UAV last-mile delivery platform. The system is designed to coordinate three primary experiences:

1. **Customer Portal** — Order placement, recipient management, live delivery tracking, and proof-of-delivery verification (OTP/QR).
2. **Admin Control Center** — Multi-tenant fleet operations, real-time UAV telemetry radar, mission dispatch, corridor and geofence management, incident handling, manual RTH/emergency intervention, and audit trail inspection.
3. **Drone Simulation** — Kinematic digital-twin simulation modeling flight phases (`IDLE → TAKEOFF → EN_ROUTE → ARRIVED → DELIVERING → RETURNING → COMPLETED`), telemetry generation, battery degradation, and failure scenario injections.

### Monorepo Topology

The repository is configured as a `pnpm` monorepo (v11.9.0) orchestrated with `Turborepo` (v2.5.0):

```text
d:/Drone-Automation-Delivery/
├── apps/
│   ├── api/                         # Fastify 5 backend (modular monolith foundation)
│   └── web/                         # Next.js 15.2 + React 19 web application shell
├── packages/
│   ├── config/                      # Shared configuration utilities
│   ├── contracts/                   # Zod domain schemas, status enums & event envelopes
│   ├── eslint-config/               # Shared ESLint configuration
│   ├── typescript-config/           # Shared TypeScript base configs
│   └── ui/                          # Shared UI component library skeleton
├── services/
│   ├── ai/                          # Python 3.11+ advisory AI service (FastAPI/Pydantic)
│   ├── notification-worker/         # Asynchronous notification dispatch worker interface
│   ├── simulator/                   # Drone simulation state machine & adapter boundary
│   └── telemetry-worker/            # Telemetry normalization, parsing & storage worker
├── db/
│   ├── migrations/                  # PostgreSQL + PostGIS SQL migration files (0001_foundation.sql)
│   ├── scripts/                     # Migration execution scripts (migrate.mjs)
│   └── seeds/                       # Database seed scripts (index.mjs)
├── edge/                            # Future edge gateway, MAVLink, and safety adapters
├── infra/                           # Docker, monitoring, Railway, Render, and Vercel manifests
├── ml/                              # ML datasets, evaluation, inference, models, training
├── tests/                           # E2E, integration, load, and security test scaffolds
└── docs/                            # Architecture, API, operations, and security documentation
```

### Safety & Execution Lifecycle

The platform enforces a deterministic mission pipeline:

$$\text{Plan} \longrightarrow \text{Validate} \longrightarrow \text{Score (Advisory)} \longrightarrow \text{Safety Check (Authoritative)} \longrightarrow \text{Authorize} \longrightarrow \text{Execute}$$

- **AI is Advisory**: Route scoring, ETA estimation, and battery models provide ranking and risk metrics, but cannot authorize a flight.
- **Safety is Authoritative**: Hard constraints (geofences, no-fly zones, maximum payload limits, mandatory 20%+ battery reserve, weather limits, operator permissions) are enforced deterministically on the server.
- **Client Zero-Trust**: Browsers and client apps never directly command drone hardware or bypass server authorization.

---

## 2. Existing Components

| Path | Component | Status | Description |
| :--- | :--- | :--- | :--- |
| [`apps/api`](file:///d:/Drone-Automation-Delivery/apps/api) | Fastify 5 API | **Scaffolded** | Basic server running on port 3001 with `/health` and `/api/v1/modules` endpoints. Modules directory contains `.gitkeep`. |
| [`apps/web`](file:///d:/Drone-Automation-Delivery/apps/web) | Next.js 15 Web Shell | **Scaffolded** | Minimal root layout and home page listing core experiences. Feature folders (`admin`, `auth`, `customer`, `maps`, `missions`, `notifications`, `orders`, `tracking`) contain `.gitkeep`. |
| [`packages/contracts`](file:///d:/Drone-Automation-Delivery/packages/contracts) | Shared Contracts | **Implemented (Base)** | Zod schemas: `organizationIdSchema`, `missionStatusSchema`, `orderStatusSchema`, `droneStatusSchema`, `coordinateSchema`, `telemetrySchema`, `eventEnvelopeSchema`. |
| [`packages/ui`](file:///d:/Drone-Automation-Delivery/packages/ui) | Shared UI Package | **Scaffolded** | Minimal package exporting `productName = "SkyNav"`. |
| [`packages/config`](file:///d:/Drone-Automation-Delivery/packages/config) | Shared Config | **Implemented (Base)** | Provides `ServiceConfig` interface and `environment()` helper. |
| [`services/ai`](file:///d:/Drone-Automation-Delivery/services/ai) | AI Service | **Scaffolded** | Python package with `AdvisoryScore` dataclass and mock functions (`score_route`, `predict_eta`, `predict_battery`, `assess_weather_risk`, `predict_maintenance`). |
| [`services/simulator`](file:///d:/Drone-Automation-Delivery/services/simulator) | Simulator Service | **Scaffolded** | TypeScript digital-twin boundary with `SimulationState` type and `SimulatorAdapter` interface. |
| [`services/telemetry-worker`](file:///d:/Drone-Automation-Delivery/services/telemetry-worker) | Telemetry Worker | **Scaffolded** | Implements `parseTelemetry()` validating against `@skynav/contracts` and defines `TelemetryPublisher`/`TelemetryStore` interfaces. |
| [`services/notification-worker`](file:///d:/Drone-Automation-Delivery/services/notification-worker) | Notification Worker | **Scaffolded** | Defines `NotificationDeliveryAdapter` interface. |
| [`db/migrations/0001_foundation.sql`](file:///d:/Drone-Automation-Delivery/db/migrations/0001_foundation.sql) | PostGIS Migration | **Implemented (DDL)** | 19 relational tables covering multi-tenancy, fleet, orders, missions, spatial waypoints, geofences, telemetry metadata, alerts, and audit logs. |
| [`docker-compose.yml`](file:///d:/Drone-Automation-Delivery/docker-compose.yml) | Local Stack | **Implemented** | Configured PostGIS 16 (`postgis/postgis:16-3.4`) and Redis 7 (`redis:7-alpine`) with health checks. |
| [`.github/workflows/quality.yml`](file:///d:/Drone-Automation-Delivery/.github/workflows/quality.yml) | CI Workflow | **Implemented** | Node 22 + pnpm quality pipeline running lint, typecheck, test, and build. |

---

## 3. Existing Dependencies

### Root & Workspaces

- **Node.js**: Target runtime LTS (>= 22.0.0)
- **Package Manager**: `pnpm@11.9.0`
- **Monorepo Engine**: `turbo@^2.5.0`, `typescript@^5.8.0`, `@types/node@^22.0.0`

### `apps/api`
- `fastify@^5.2.0`
- `zod@^3.24.0`
- `@skynav/contracts@workspace:*`
- Dev: `tsx@^4.19.0`

### `apps/web`
- `next@^15.2.0`
- `react@^19.0.0`
- `react-dom@^19.0.0`
- Dev: `@types/react@^19.0.0`, `@types/react-dom@^19.0.0`

### `packages/contracts`
- `zod@^3.24.0`

### `services/ai`
- Python `Requires-Python >= 3.11`

### `services/simulator` & `services/telemetry-worker`
- `@skynav/contracts@workspace:*`
- Dev: `tsx@^4.19.0`

---

## 4. Missing Components

1. **Identity, Authentication & RBAC Engine**:
   - No password hashing (Argon2id/bcrypt), JWT session issuance, refresh token rotation, or HTTP cookie management.
   - No authorization middleware enforcing tenant isolation (`organization_id`) or role permissions (`Platform Admin`, `Org Owner`, `Fleet Manager`, `Mission Operator`, `Dispatcher`, `Customer`).
2. **API Domain Implementation**:
   - All 19 modules declared in [`apps/api/src/server.ts`](file:///d:/Drone-Automation-Delivery/apps/api/src/server.ts) (`auth`, `organizations`, `users`, `drones`, `orders`, `missions`, `routes`, `geofences`, `weather`, `telemetry`, `alerts`, etc.) are empty directories without route handlers, use-cases, or repository queries.
3. **Database Client & Migration Execution**:
   - [`db/scripts/migrate.mjs`](file:///d:/Drone-Automation-Delivery/db/scripts/migrate.mjs) explicitly exits with code 1; no database query builder (e.g. Kysely/Drizzle) or connection pool is connected.
   - [`db/seeds/index.mjs`](file:///d:/Drone-Automation-Delivery/db/seeds/index.mjs) has no seed fixtures.
4. **Realtime Transport & Telemetry Ingestion**:
   - No WebSocket gateway (`@fastify/websocket`) in `apps/api`.
   - No Redis Pub/Sub pub/sub fanout adapter to stream live drone coordinates to the frontend.
5. **Interactive Map Component**:
   - No map library or tile provider integration in `apps/web/src/features/maps`.
   - No visual rendering of drone markers, trails, corridor paths, or geofence boundary polygons.
6. **Kinematic Simulator Engine**:
   - `services/simulator` lacks a running tick loop, waypoint interpolation, physics calculation, or network telemetry dispatch.
7. **Frontend Design System & Screens**:
   - No Tailwind CSS, component library (shadcn/ui), icons (Lucide), state store (Zustand), or data-fetching cache (TanStack Query).
   - No actual UI pages for Order Creation, Tracking Portal, or Admin Operations Center.
8. **Automated Test Suites**:
   - Zero test files (`*.test.ts`, `*.spec.ts`, `test_*.py`) exist in the repository.
9. **Environment Configuration Template**:
   - Missing `.env.example` file in the root directory.

---

## 5. Architecture Risks

1. **High-Frequency Telemetry Ingestion Congestion**:
   - *Risk*: Persisting raw 10Hz telemetry directly to relational PostgreSQL tables will cause rapid table bloat, lock contention, and I/O saturation. Broadcasting raw telemetry to all connected clients will freeze browser rendering.
   - *Mitigation*: Ingest telemetry into Redis Streams/Hashes for hot state; batch/downsample operational history writes; push rate-limited (2–5Hz) smoothed deltas to active UI viewports over WebSockets.
2. **Cross-Tenant Data Leakage & Authorization Bypass**:
   - *Risk*: A client could tamper with `organization_id` or send unauthorized flight commands (`ABORT`, `RETURN_TO_HOME`) if authorization relies on payload values.
   - *Mitigation*: Enforce mandatory server-side authentication context. Every database query and command execution must inject `ctx.organizationId` and verify actor roles before execution.
3. **AI Safety Over-Reliance**:
   - *Risk*: Relying on AI route recommendations without deterministic pre-flight safety validation could route UAVs into active no-fly zones, inclement weather, or beyond battery reserves.
   - *Mitigation*: The mission pipeline strictly isolates AI route scoring as advisory. Pre-flight deterministic validation (`ST_Intersects` on geofences, battery calculation, weather checks) must execute independently before mission authorization.
4. **Contract Drift Across Distributed Packages**:
   - *Risk*: Independent modifications to domain entities across `apps/web`, `apps/api`, `services/simulator`, and `services/ai` could create incompatible message formats.
   - *Mitigation*: Enforce all wire types in `@skynav/contracts`. Changes require contract updates and cross-workspace validation in CI before implementation.
5. **Database Migration Desynchronization**:
   - *Risk*: Unversioned or manual DDL modifications will cause environment drift between local Docker, CI, staging, and production.
   - *Mitigation*: Adopt a deterministic, transactional migration runner with a migration ledger table (`_schema_migrations`) validating checksums.

---

## 6. Recommended Technology Choices

```mermaid
graph TD
    subgraph Frontend [Client Layer - Next.js 15 / Vercel]
        UI[Customer & Admin UI - Tailwind CSS + shadcn/ui]
        Map[MapLibre GL JS - Canvas & Layers]
        RQ[TanStack Query v5 + Zustand]
        WSClient[WebSocket Client]
    end

    subgraph Gateway [Backend Layer - Fastify 5 / Railway]
        API[Fastify Modular REST API]
        WSServer[Fastify WebSocket Gateway]
        AuthGuard[RBAC & Tenant Scoping Guard]
        SafetyEngine[Deterministic Safety Validator]
    end

    subgraph Data [Storage & State Layer]
        PG[(PostgreSQL 16 + PostGIS)]
        Redis[(Redis 7 - Pub/Sub & Cache)]
    end

    subgraph Workers [Async & Processing Layer]
        Sim[Kinematic Simulator Service]
        TelemWorker[Telemetry Normalization Worker]
        NotifWorker[Notification Worker]
        AIService[Python FastAPI Advisory Service]
    end

    UI -->|HTTPS / REST| API
    Map -->|Render| UI
    WSClient <-->|WebSocket Stream| WSServer
    API --> AuthGuard
    AuthGuard --> SafetyEngine
    SafetyEngine -->|Kysely / pg| PG
    API <-->|State / Locks| Redis
    WSServer <-->|Subscribe| Redis
    Sim -->|Telemetry Events| Redis
    Redis --> TelemWorker
    TelemWorker -->|Update Hot State| Redis
    TelemWorker -->|Batch Metadata| PG
    API -->|Async Job| NotifWorker
    API -->|Advisory Request| AIService
```

| Domain | Recommended Technology | Rationale |
| :--- | :--- | :--- |
| **Backend API** | **Fastify 5** | High-throughput, low overhead, native schema compilation, built-in encapsulation. |
| **Database Access** | **Kysely** (with `pg`) | Type-safe SQL query builder with zero runtime bloat, seamless PostGIS geometry support, and explicit tenant scoping. |
| **Frontend Framework**| **Next.js 15 (App Router)** | Modern React 19 architecture, Server Components for SEO/initial load, Client Components for real-time dashboards. |
| **Styling & Components**| **Tailwind CSS + shadcn/ui** | Clean glassmorphic operational aesthetics, accessible Radix primitives, consistent design tokens. |
| **Client State** | **TanStack Query + Zustand** | Query caching for REST resources; Zustand for active map selections, UI layout, and telemetry buffers. |
| **Realtime** | **Native WebSocket (`@fastify/websocket`) + Redis Pub/Sub** | Standardized bi-directional transport with low latency and scalable multi-instance pub/sub distribution. |
| **Map Rendering** | **MapLibre GL JS** | Open-source WebGL hardware-accelerated mapping with zero vendor lock-in and high-density vector rendering. |
| **Advisory AI** | **Python 3.11+ / FastAPI / Shapely** | High-performance geospatial and machine learning ecosystem with clear REST boundaries. |
| **Testing** | **Vitest + Playwright + Supertest** | Fast unit and integration testing in TypeScript; robust cross-browser E2E testing for mission workflows. |

---

## 7. Map Recommendation

### Primary Choice: **`MapLibre GL JS`**

#### Why MapLibre GL JS:
1. **Performance at Scale**: Uses WebGL/WebGPU to render hundreds of dynamic entities simultaneously (drone position markers, heading cones, smooth historical breadcrumb trails, multi-segment mission corridors, and complex polygon no-fly zones) at 60 FPS without DOM thrashing.
2. **Open-Source & Zero Vendor Lock-in**: 100% open-source (BSD license) fork of Mapbox GL JS. Free from per-map-load commercial licensing traps. Compatible with multiple tile providers (OpenStreetMap, Carto, Stadia, self-hosted PMTiles).
3. **Geospatial Feature Set**: First-class GeoJSON support, 3D terrain extrusion, dynamic layer filtering, vector tile rendering, and custom WebGL shaders.

#### Map Abstraction Architecture

Feature components must never call MapLibre APIs directly. A modular React abstraction will isolate the mapping provider:

```text
packages/ui/ (or apps/web/src/features/maps/)
├── components/
│   ├── SkyNavMap.tsx                # Base viewport container with theme/camera controls
│   ├── DroneMarkerLayer.tsx         # Real-time drone position & heading visualization
│   ├── MissionRouteLayer.tsx        # Planned vs actual flight trajectory polyline
│   ├── GeofencePolygonLayer.tsx     # Color-coded no-fly & delivery zone polygons
│   └── WaypointPinLayer.tsx         # Interactive waypoint drag/drop markers
└── hooks/
    ├── useMapViewport.ts            # Viewport bounds & zoom management
    └── useInterpolatedPosition.ts   # Smooth 60fps coordinate interpolation between telemetry ticks
```

---

## 8. Realtime Recommendation

### Telemetry & Event Streaming Architecture

```text
[Kinematic Simulator / Drone Gateway]
                │
                │ 2-10 Hz Telemetry Frame
                ▼
      [Redis Ingestion Stream]
                │
                ▼
   [Telemetry Processing Worker]
        ├── Validate against @skynav/contracts
        ├── Update Redis Hot State Hash: `drone:{id}:state`
        ├── Batch checkpoint metadata to PostgreSQL
        └── Publish to Redis Pub/Sub: `channel:org:{orgId}:telemetry`
                │
                ▼
      [Fastify WebSocket Server] (apps/api)
        ├── Authenticate connection (Session/JWT)
        ├── Authorize channel subscription (Tenant / Mission scope)
        ├── Rate-limit & coalesce updates (2-5 Hz per active drone)
        └── Push JSON frame to client WebSocket
                │
                ▼
       [Customer & Admin UI] (apps/web)
        └── Zustand buffer -> Map marker interpolation & telemetry gauges
```

#### Realtime Topics & Channel Conventions:
- `org:{orgId}:fleet:telemetry` — Low-frequency aggregate fleet positions for Admin Radar.
- `mission:{missionId}:telemetry` — High-frequency flight telemetry and status for active tracking.
- `org:{orgId}:alerts` — Critical system notifications, geofence breaches, and incident triggers.
- `order:{orderId}:status` — Order lifecycle updates for customer portal.

---

## 9. Database Strategy

### Multi-Tenancy & Spatial Schema

- **Engine**: PostgreSQL 16 with PostGIS extension.
- **Tenant Isolation**: Non-nullable `organization_id UUID NOT NULL REFERENCES organizations(id)` present on all tenant records. Repository queries must inject tenant context server-side:
  ```sql
  SELECT * FROM missions WHERE id = $1 AND organization_id = $2;
  ```
- **Spatial Storage**:
  - Waypoints stored as 3D points: `geometry(PointZ, 4326)`.
  - Geofences and delivery zones stored as 2D polygons: `geometry(Polygon, 4326)` or `geometry(MultiPolygon, 4326)`.
  - Spatial indexes: `CREATE INDEX idx_geofences_boundary ON geofences USING GIST(boundary);`.
  - Spatial validation functions: `ST_Intersects`, `ST_Contains`, `ST_DWithin`.

### Storage Tiering Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. HOT STATE (Redis 7)                                                 │
│    - Latest drone position, battery, speed, heading (Key-Value/Hash)   │
│    - TTL: 60 seconds (ephemeral)                                       │
├────────────────────────────────────────────────────────────────────────┤
│ 2. OPERATIONAL STATE (PostgreSQL 16 + PostGIS)                         │
│    - Orders, Missions, Fleet, Waypoints, Geofences, Alerts, Audit Logs │
│    - Periodic trajectory checkpoints (10-30s intervals)                │
├────────────────────────────────────────────────────────────────────────┤
│ 3. ANALYTICAL / FLIGHT LOG ARCHIVE (Cold Storage - Future)             │
│    - Parquet / TimescaleDB hypertable for full flight replay & ML      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. API Strategy

- **Framework**: Fastify 5 with modular domain encapsulation.
- **Route Organization**:
  ```text
  apps/api/src/modules/
  ├── auth/            # Registration, login, session validation, logout
  ├── organizations/   # Multi-tenant organization provisioning & membership
  ├── users/           # User profiles and preferences
  ├── fleet/           # Drone models, aircraft registration, maintenance status
  ├── orders/          # Customer order creation, package specifications
  ├── missions/        # Flight planning, validation, authorization, dispatch
  ├── geofences/       # Airspace boundaries, no-fly zones, corridor definitions
  ├── telemetry/       # Ingestion endpoints & historical query routes
  ├── alerts/          # System alerts, incidents, emergency triggers
  └── audit/           # Immutable action history & compliance logs
  ```
- **Module Architecture**:
  ```text
  modules/<name>/
  ├── domain/          # Pure entities, domain rules, state machines
  ├── application/     # Use-cases, service orchestrators, command handlers
  ├── infrastructure/  # Database repositories (Kysely queries), external adapters
  ├── http/            # Fastify route schemas, controllers, DTO serializers
  └── tests/           # Unit & integration tests
  ```
- **Validation**: Schema-first validation using `@skynav/contracts` and `fastify-type-provider-zod`.
- **Standardized Error Envelope (RFC 7807)**:
  ```json
  {
    "type": "https://skynav.io/errors/geofence-violation",
    "title": "Geofence Violation Detected",
    "status": 422,
    "detail": "Planned waypoint sequence intersects restricted airspace [NFZ-004].",
    "instance": "/api/v1/missions/plan",
    "code": "GEOFENCE_INTERSECTION",
    "timestamp": "2026-08-28T12:34:56Z"
  }
  ```

---

## 11. Frontend Strategy

### Visual & Experience Design Direction
- **Commercial-Grade Operations HUD**: Glassmorphic styling with structured typography, restrained animations, dark-mode default for control room operations, and clean high-contrast daytime mode for customer portal.
- **Responsive Architecture**: Mobile-first PWA for customer tracking and delivery OTP/QR verification; widescreen multi-panel layout for Admin Fleet Radar.

### Feature Boundaries (`apps/web/src/features/`)
1. `auth`: Login, registration, tenant switching, session persistence.
2. `customer`: Order wizard (weight, dimensions, destination selector), active order status tracker, proof-of-delivery verification modal.
3. `admin`: Fleet status table, live mission radar, manual RTH/abort controls, geofence polygon management, alert notifications banner, audit log viewer.
4. `maps`: MapLibre canvas integration, vehicle smoothing hooks, corridor overlays, interactive waypoint planner.
5. `tracking`: Lightweight, public tracking page for recipients.

---

## 12. Simulator Strategy

### Kinematic Simulation Engine (`services/simulator`)

The simulation service operates in two phases:

1. **Phase 1: Deterministic Kinematic Engine (Current Platform Goal)**
   - Configurable tick loop (1–5Hz).
   - Physics & state transitions:
     - Altitude climb/descent rate calculation.
     - Waypoint-to-waypoint ground speed and heading calculation.
     - Battery consumption model factoring in payload weight, cruise speed, and headwind.
     - Simulated delivery sequence: Hover $\rightarrow$ Descend $\rightarrow$ Await OTP/QR confirmation $\rightarrow$ Ascend $\rightarrow$ Return to Home (RTH).
   - Failure injection engine: Low battery emergency, GPS accuracy degradation, communication timeout, geofence boundary penetration.
2. **Phase 2: SITL & MAVLink Integration (Future Research)**
   - Software-In-The-Loop (SITL) with PX4/ArduPilot and Gazebo simulation over MAVLink/UDP.

---

## 13. AI Strategy

- **Service Framework**: Python 3.11+ / FastAPI (`services/ai`).
- **Core ML & Heuristic Tasks**:
  1. **Route Scoring**: Evaluates candidate paths against distance, weather severity, airspace congestion, and terrain elevation.
  2. **ETA Estimation**: Predicts delivery arrival time considering dynamic wind profiles and delivery verification latency.
  3. **Battery Depletion Model**: Validates flight plan energy requirements against historical discharge curves to guarantee mandatory safety reserves ($> 20\%$).
  4. **Predictive Maintenance**: Evaluates battery charge cycle health and motor flight hours to schedule preventative maintenance.
- **Fail-Safe Fallback**: If the AI service is offline or degraded, the API immediately falls back to deterministic geometric distance calculation without stalling dispatch operations.

---

## 14. Security Strategy

1. **Tenant Isolation**: Mandatory `organization_id` scoping on every protected database query.
2. **Role-Based Access Control (RBAC)**:
   - `Platform Admin`: Global system administration.
   - `Org Owner`: Full tenant resource and user management.
   - `Fleet Manager`: Aircraft registration, maintenance scheduling.
   - `Mission Operator`: Route planning, mission authorization, emergency intervention.
   - `Dispatcher`: Order creation, delivery assignment.
   - `Customer`: Order placement, tracking own deliveries.
3. **Deterministic Safety Enforcement**: Flight authorization requires valid operator credentials, no spatial geofence intersections, battery reserve $\ge 20\%$, and weather risk within operating minimums.
4. **Audit Logging**: Asynchronous, immutable audit log records written for all privileged actions (`MISSION_AUTHORIZED`, `EMERGENCY_ABORT`, `RETURN_TO_HOME_TRIGGERED`, `GEOFENCE_CREATED`).
5. **Zero Secret Leakage**: Zero secrets stored in Git. Strict environment validation at startup.

---

## 15. Testing Strategy

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Unit Tests (Vitest / pytest)                                           │
│ - Mission state machine transitions                                    │
│ - PostGIS geometry validation logic                                    │
│ - Battery reserve mathematical checks                                  │
│ - Zod contract parsing & validation                                    │
├────────────────────────────────────────────────────────────────────────┤
│ Integration Tests (Vitest + Fastify Inject + TestContainers / Postgres)│
│ - Multi-tenant isolation verification                                  │
│ - RBAC role-permission enforcement                                     │
│ - Order-to-Mission authorization pipeline                              │
│ - Telemetry ingestion & normalization flow                             │
├────────────────────────────────────────────────────────────────────────┤
│ End-to-End Tests (Playwright)                                          │
│ - Customer order submission -> Delivery tracking flow                  │
│ - Admin mission dispatch -> Real-time radar visualization              │
│ - Emergency RTH operator override flow                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 16. CI/CD Strategy

### Continuous Integration Pipeline (`.github/workflows/quality.yml`)
- **Triggers**: Pull requests targeting `develop` and pushes to `develop` / `main`.
- **Quality Gates**:
  1. `pnpm install --frozen-lockfile`
  2. `pnpm lint` (TypeScript + ESLint)
  3. `pnpm typecheck` (All workspaces)
  4. `pnpm test` (Unit & integration suites)
  5. `pnpm build` (Next.js & service builds)

### Continuous Delivery Workflow
- **Staging Deployment**: Automated deployment on merge to `develop`.
- **Production Deployment**: Tagged releases or merge from `develop` to `main` with approval protections.

---

## 17. Deployment Architecture

```text
                     ┌─────────────────────────────────────────┐
                     │          Vercel Global Edge CDN         │
                     │          apps/web (Next.js 15)          │
                     └────────────────────┬────────────────────┘
                                          │ HTTPS / WSS
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │       Railway / Render Web Service      │
                     │           apps/api (Fastify 5)          │
                     └──────┬───────────────────────────┬──────┘
                            │                           │
            ┌───────────────┴───────────────┐           │
            ▼                               ▼           ▼
 ┌──────────────────────┐        ┌─────────────────────────────┐
 │ Managed PostgreSQL   │        │ Managed Redis 7             │
 │ + PostGIS            │        │ - Pub/Sub Event Bus         │
 │ (Neon/Supabase/Cloud)│        │ - Hot Telemetry State       │
 └──────────────────────┘        └──────────────┬──────────────┘
                                                │
                                 ┌──────────────┴──────────────┐
                                 ▼                             ▼
                  ┌─────────────────────────────┐ ┌───────────────────────────┐
                  │ Railway Background Worker   │ │ Railway Background Worker │
                  │ services/telemetry-worker   │ │ services/simulator        │
                  └─────────────────────────────┘ └───────────────────────────┘
                                                │
                                                ▼
                                 ┌─────────────────────────────┐
                                 │ Railway Python Container    │
                                 │ services/ai (FastAPI)       │
                                 └─────────────────────────────┘
```

---

## 18. Environment Configuration Strategy

Create and maintain a comprehensive `.env.example` file in the project root:

```ini
# ==============================================================================
# SkyNav Platform Environment Configuration
# ==============================================================================

# Node Environment
NODE_ENV=development

# Fastify API Server
API_PORT=3001
API_HOST=0.0.0.0
API_CORS_ORIGIN=http://localhost:3000

# Next.js Web Application
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/api/v1/realtime
NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json

# PostgreSQL + PostGIS Database
DATABASE_URL=postgresql://skynav:skynav@localhost:5432/skynav

# Redis (Pub/Sub, Caching, Streams)
REDIS_URL=redis://localhost:6379

# Authentication & Security
JWT_SECRET=super-secret-jwt-key-min-32-chars-long
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Advisory AI Service
AI_SERVICE_URL=http://localhost:8000

# Simulation Configuration
SIMULATOR_TICK_RATE_HZ=2
SIMULATOR_AUTO_START=false
```

---

## 19. Milestone Dependency Graph

```mermaid
graph TD
    M1[Milestone 1: Platform & Identity Foundation]
    M2[Milestone 2: Order-to-Simulated-Delivery Vertical Slice]
    M3[Milestone 3: Geospatial Safety & Incident Operations]
    M4[Milestone 4: Advisory AI & Predictive Routing]
    M5[Milestone 5: Research & High-Fidelity Simulation]

    M1 --> M2
    M2 --> M3
    M3 --> M4
    M4 --> M5

    subgraph M1_Scope [Milestone 1 Core Deliverables]
        M1_A[Database Adapter & Migrations]
        M1_B[Authentication & Multi-Tenant RBAC]
        M1_C[Contracts Expansion & Validation]
        M1_D[CI Quality Gates & Local Stack]
    end

    subgraph M2_Scope [Milestone 2 Core Deliverables]
        M2_A[Order Creation & Management]
        M2_B[Mission Lifecycle & Dispatch]
        M2_C[Kinematic Simulator & Telemetry]
        M2_D[MapLibre Realtime Radar & Tracking]
        M2_E[OTP/QR Proof-of-Delivery Verification]
    end

    M1_A --> M2_A
    M1_B --> M2_A
    M1_C --> M2_B
    M2_A --> M2_B
    M2_B --> M2_C
    M2_C --> M2_D
    M2_D --> M2_E
```

---

## 20. Recommended Implementation Order

To maintain stability, avoid architectural drift, and deliver continuous verified value, work should proceed in the following exact sequence:

1. **Step 1: Database Adapter & Migration Engine (Immediate Priority)**
   - Connect `Kysely` (with `pg` pool) in `apps/api`.
   - Implement transactional migration runner in `db/scripts/migrate.mjs` to execute `0001_foundation.sql`.
   - Create foundational seed fixtures (`db/seeds/index.mjs`) with standard organization, roles, and test users.
2. **Step 2: Identity, Authentication & Tenant Scoping Middleware**
   - Implement JWT + refresh token authentication routes (`/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`).
   - Implement Fastify pre-handler hooks enforcing tenant isolation (`ctx.organizationId`) and role-based permissions.
3. **Step 3: Expanded Domain Contracts & Wire Types**
   - Expand `packages/contracts` to include Order, Mission Planning, Drone Fleet, and Proof-of-Delivery schemas.
4. **Step 4: Customer Order & Drone Fleet Domain Modules**
   - Implement `apps/api/src/modules/orders` and `apps/api/src/modules/fleet`.
   - Enable customer order submission and automated drone capacity matching.
5. **Step 5: Mission State Machine & Deterministic Safety Engine**
   - Implement `apps/api/src/modules/missions` state transitions (`PLANNED → VALIDATING → READY → AUTHORIZED → DISPATCHED`).
   - Implement PostGIS spatial validation checking candidate waypoints against geofences.
6. **Step 6: Kinematic Simulator & Telemetry Streaming**
   - Implement simulation runner in `services/simulator` with waypoint progression and battery discharge modeling.
   - Implement Fastify WebSocket gateway `/api/v1/realtime` backed by Redis Pub/Sub.
7. **Step 7: Frontend Design System & Customer Experience**
   - Configure Tailwind CSS, shadcn/ui components, and Lucide icons in `apps/web`.
   - Build Customer Order Creation Wizard and Live Delivery Tracking page.
8. **Step 8: Admin Control Center & Interactive MapLibre Radar**
   - Build Admin Fleet Operations dashboard with MapLibre GL JS map rendering live drone markers, flight corridors, and geofences.
   - Build operator command interface (Authorize, Hold, Return-To-Home, Abort).
9. **Step 9: Proof-of-Delivery Verification Flow**
   - Implement OTP/QR generation and verification handshake on delivery arrival.
10. **Step 10: Advisory AI Service & Advanced Operations**
    - Connect Python FastAPI service for route risk scoring and ETA prediction.
    - Implement incident reporting, weather intelligence snapshots, and audit log exploration.
